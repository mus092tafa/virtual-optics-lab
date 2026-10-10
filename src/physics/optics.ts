/**
 * System solver: turns the physical bench layout into the light that reaches
 * the screen.
 *
 *   PHYSICAL SYSTEM -> ray / wave calculation -> light at screen -> display
 *
 * The solver picks the physical model appropriate to the configuration:
 *
 *   geometric optics   object + lenses        -> image, magnification, defocus
 *   Gaussian beam      laser + lenses         -> beam radius along the bench
 *   wave optics        source + slit(s)       -> diffraction / interference
 *                      source + grating       -> diffraction orders / spectra
 *                      laser + pinhole        -> Airy pattern
 *
 * Polarisers only scale the power. A spherical mirror folds the path back
 * along the rail; it is solved as a thin lens of the same focal length on the
 * unfolded axis and the drawing geometry is folded back afterwards.
 *
 * It contains no rendering code and knows nothing about pixels.
 */
import { airyDiscRadius, airyFirstZeroAngle, airyIntensity } from './airy'
import {
  DEFAULT_LENS_APERTURE,
  GRATING_APERTURE,
  GRATING_MAX_ORDER,
  GRATING_OPEN_FRACTION,
  HENE_WAIST_RADIUS,
  RAIL_LENGTH,
  SCREEN_HALF_SIZE,
  SLIT_LENGTH,
  TUNGSTEN_TEMPERATURE,
  WHITE_LIGHT_REFERENCE_WAVELENGTH,
  laserLine,
} from './constants'
import { centralMaximumWidth, classifyRegime, fresnelNumber, singleSlitMinimumAngle } from './diffraction'
import type { FieldRegime } from './diffraction'
import { divergenceHalfAngle, propagateBeam, rayleighRange, wavefrontRadius } from './gaussianBeam'
import type { BeamPath, BeamSample } from './gaussianBeam'
import { buildGratingSpectrum, gratingPeriod, highestOrder, laserOrderSpots, orderAngle, orderEfficiency } from './grating'
import { fringeAngularSpacing, fringeSpacing, fringesInCentralMaximum } from './interference'
import { principalRays } from './lenses'
import type { Point, PrincipalRay } from './lenses'
import { polarizerChain } from './polarization'
import type { PolarizationState } from './polarization'
import { lensesBetween, projectOntoScreen, sequentialImaging, systemMatrix, traceRay } from './rayTransfer'
import type { SequentialImage } from './rayTransfer'
import { apertureHalfExtent, buildSlitPattern } from './slitPattern'
import type { SlitPattern, SpectralLine } from './slitPattern'
import { blackbodyRgb, blackbodySpectrum, wavelengthToRgb } from './spectrum'
import type { Rgb } from './spectrum'
import type {
  ApertureComponent,
  BenchComponent,
  DiffractionModel,
  GratingComponent,
  LaserComponent,
  LensComponent,
  MirrorComponent,
  ObjectComponent,
  ObjectShape,
  PinholeComponent,
  PolarizerComponent,
  ScreenComponent,
  SlitOrientation,
  SourceComponent,
} from './types'
import { mm } from './units'

export interface SolveOptions {
  diffractionModel: DiffractionModel
}

export interface Notice {
  level: 'info' | 'warning' | 'error'
  text: string
}

export type LuminousShape = ObjectShape | 'disc'

/** Light distribution arriving at the observation screen. */
export type ScreenLight =
  | { kind: 'dark'; reason: string }
  | { kind: 'unsupported'; reason: string }
  /** Featureless illumination. */
  | { kind: 'uniform'; rgb: Rgb; level: number }
  /** Gaussian laser spot of 1/e² radius `radius`. */
  | { kind: 'spot'; rgb: Rgb; level: number; radius: number }
  /** Geometric image of a luminous object, possibly out of focus. */
  | {
      kind: 'image'
      rgb: Rgb
      level: number
      shape: LuminousShape
      letter: string
      objectHeight: number
      /** 'base': the object stands on the axis; 'center': it is centred on it. */
      anchor: 'base' | 'center'
      /** Signed picture scale on the screen (negative = inverted). */
      scale: number
      /** Diameter of the defocus blur disc on the screen. */
      blurDiameter: number
      /** 1/e² radius of laser illumination on the object, if laser-lit. */
      illuminationRadius: number | null
    }
  /** Separate elliptical Gaussian spots in a row (laser diffraction orders). */
  | {
      kind: 'spots'
      rgb: Rgb
      level: number
      /** Direction of the grating lines; the spots are spread perpendicular to it. */
      orientation: SlitOrientation
      spots: readonly ScreenSpot[]
    }
  /** Arbitrary two-dimensional intensity distribution (e.g. interferometer fringes). */
  | { kind: 'field'; rgb: Rgb; level: number; intensity(u: number, v: number): number }
  /** Diffraction / interference pattern. */
  | {
      kind: 'fringes'
      pattern: SlitPattern
      /** Long axis of the slit; the pattern spreads perpendicular to it. */
      orientation: SlitOrientation
      /** Extent of the light along the slit direction. */
      band: { profile: 'gaussian'; radius: number } | { profile: 'flat'; halfHeight: number; edge: number }
    }

export interface ScreenSpot {
  /** Centre along the direction in which the spots are spread. */
  position: number
  /** 1/e² radii along and across that direction. */
  radiusAlong: number
  radiusAcross: number
  /** Peak irradiance relative to the brightest spot. */
  level: number
}

export interface ImagingSolution {
  /** What forms the image: thin lenses, or a spherical mirror. */
  element: 'lens' | 'mirror'
  objectX: number
  objectHeight: number
  /** Lens-by-lens thin-lens solution; null when no lens follows the object. */
  sequence: SequentialImage | null
  /** Signed final image height (negative = inverted). */
  imageHeight: number | null
  screen: {
    /** Distance from the last lens to the screen. */
    distance: number
    scale: number
    blurDiameter: number
    inFocus: boolean
    /** Image irradiance per unit object radiance, π u² / scale² (steradian). */
    irradiancePerRadiance: number
  } | null
}

export interface BeamSolution {
  wavelength: number
  waistRadius: number
  rayleighRange: number
  divergenceHalfAngle: number
  path: BeamPath
  /** 1/e² radius on the screen, when the beam reaches it unobstructed. */
  radiusAtScreen: number | null
}

export interface DiffractionSolution {
  kind: 'single' | 'double'
  polychromatic: boolean
  /** Laser wavelength, or the reference wavelength used to quote numbers for white light. */
  wavelength: number
  slitWidth: number
  separation: number | null
  /** Geometric slit-to-screen distance. */
  distance: number
  /** Ray-matrix B element slit -> screen (equals `distance` in free space). */
  effectiveB: number
  fresnelNumber: number
  regime: FieldRegime
  model: DiffractionModel
  firstMinimumAngle: number | null
  centralMaximumWidth: number
  fringeSpacing: number | null
  fringeAngularSpacing: number | null
  fringesInCentralMaximum: number | null
  /** Smearing of the pattern by the finite size of an incoherent source. */
  smearWidth: number
  /** Laser beam radius at the slit plane. */
  beamRadiusAtSlit: number | null
}

export interface GratingOrder {
  order: number
  angle: number
  /** Position on the screen plane, y = L tan θ; null when there is no screen. */
  position: number | null
  /** Fraction of the incident power in this order. */
  efficiency: number
  /** False when the order lands outside the 12 cm screen. */
  onScreen: boolean
}

export interface GratingSolution {
  lineDensity: number
  period: number
  polychromatic: boolean
  /** Laser wavelength, or the reference wavelength used to quote numbers for white light. */
  wavelength: number
  /** Grating-to-screen distance; null when there is no screen. */
  distance: number | null
  /** Number of grating lines covered by the light. */
  illuminatedLines: number
  /** Orders of the reference wavelength, m ≥ 0 (the pattern is symmetric). */
  orders: GratingOrder[]
  beamRadiusAtGrating: number | null
}

export interface AirySolution {
  wavelength: number
  diameter: number
  /** Geometric aperture-to-screen distance. */
  distance: number
  /** Ray-matrix B element aperture -> screen (equals `distance` in free space). */
  effectiveB: number
  fresnelNumber: number
  regime: FieldRegime
  firstZeroAngle: number | null
  /** Radius of the first dark ring on the screen, 1.22 λ L / D. */
  firstDarkRingRadius: number
  beamRadiusAtAperture: number
}

export interface PolarizationSolution {
  /** Fraction of the source power that reaches the screen. */
  transmission: number
  /** Polarisers in the order the light meets them, with the cumulative fraction after each. */
  stages: { id: string; angle: number; transmission: number }[]
  state: PolarizationState
}

export interface MirrorSolution {
  x: number
  focalLength: number
  /** Radius of curvature R = 2f. */
  radius: number
}

export interface ImageMarker {
  x: number
  height: number
  isReal: boolean
  isFinal: boolean
}

/** Geometry for drawing light on the side view of the bench (physical units). */
export interface BenchOverlay {
  lightRgb: Rgb
  /** Gaussian beam envelope (1/e² radius). */
  beam: BeamSample[] | null
  /** The same beam after reflection at a mirror, travelling back along the rail. */
  reflectedBeam: BeamSample[] | null
  /** Diffraction orders leaving a grating. */
  orders: { x: number; xEnd: number; inViewPlane: boolean; rays: { order: number; angle: number; strength: number }[] } | null
  /** Diffracted light behind a slit, out to the first minimum. */
  fan: { x: number; xEnd: number; halfAngle: number; inViewPlane: boolean } | null
  /** Flood of light leaving the tungsten lamp. */
  lampCone: { x0: number; x1: number; halfHeight0: number; halfHeight1: number } | null
  /** Marginal rays from the axial object point through the lens apertures. */
  bundle: { upper: Point[]; lower: Point[] } | null
  principalRays: PrincipalRay[]
  images: ImageMarker[]
}

export type Regime = 'no-source' | 'beam' | 'imaging' | 'illumination' | 'diffraction' | 'unsupported'
export type PhysicsModel = 'none' | 'geometric optics' | 'Gaussian beam optics' | 'wave optics'

export interface BenchSolution {
  regime: Regime
  model: PhysicsModel
  source: SourceComponent | null
  /** Laser wavelength; null for the broadband tungsten source. */
  wavelength: number | null
  /** Null when there is no screen on the bench. */
  screenLight: ScreenLight | null
  notices: Notice[]
  imaging: ImagingSolution | null
  beam: BeamSolution | null
  diffraction: DiffractionSolution | null
  grating: GratingSolution | null
  airy: AirySolution | null
  /** Null when no polariser is in the light path. */
  polarization: PolarizationSolution | null
  /** Null when no mirror is in the light path. */
  mirror: MirrorSolution | null
  overlay: BenchOverlay
}

/** Blur discs smaller than this are indistinguishable from a sharp image by eye. */
export const SHARP_BLUR_LIMIT = mm(0.2)
/** Half-angle used to draw the flood of light from the lamp housing. */
const LAMP_FLOOD_HALF_ANGLE = 0.18
const LAMP_FLOOD_MAX_HALF_HEIGHT = mm(24)

interface LuminousObject {
  x: number
  height: number
  shape: LuminousShape
  letter: string
  anchor: 'base' | 'center'
  illuminationRadius: number | null
}

function byKind<K extends BenchComponent['kind']>(
  components: readonly BenchComponent[],
  kind: K,
): Extract<BenchComponent, { kind: K }>[] {
  return components.filter((c): c is Extract<BenchComponent, { kind: K }> => c.kind === kind)
}

function emptyOverlay(lightRgb: Rgb): BenchOverlay {
  return {
    lightRgb,
    beam: null,
    reflectedBeam: null,
    orders: null,
    fan: null,
    lampCone: null,
    bundle: null,
    principalRays: [],
    images: [],
  }
}

/** Approximate fraction of the bounding square h × h that a shape fills. */
function shapeFillFraction(shape: LuminousShape): number {
  switch (shape) {
    case 'rectangle':
      return 0.6
    case 'circle':
    case 'disc':
      return Math.PI / 4
    default:
      return 0.3
  }
}

export function solveBench(components: readonly BenchComponent[], options: SolveOptions): BenchSolution {
  const sources: SourceComponent[] = [...byKind(components, 'laser'), ...byKind(components, 'tungsten')]
  const source = sources[0] ?? null
  const screen: ScreenComponent | null = byKind(components, 'screen')[0] ?? null

  if (!source) {
    return {
      regime: 'no-source',
      model: 'none',
      source: null,
      wavelength: null,
      screenLight: screen ? { kind: 'dark', reason: 'No light source on the bench.' } : null,
      notices: [{ level: 'info', text: 'Add a He-Ne laser or the tungsten lamp to begin.' }],
      imaging: null,
      beam: null,
      diffraction: null,
      grating: null,
      airy: null,
      polarization: null,
      mirror: null,
      overlay: emptyOverlay([0, 0, 0]),
    }
  }

  const wavelength = source.kind === 'laser' ? laserLine(source.lineId).wavelength : null
  const lightRgb = wavelength !== null ? wavelengthToRgb(wavelength) : blackbodyRgb(TUNGSTEN_TEMPERATURE)
  const notices: Notice[] = []
  const overlay = emptyOverlay(lightRgb)

  // Light travels in +x. A mirror sends it back; the rest of the solver then
  // works on the unfolded axis, where the mirror is a thin lens at x_m and a
  // point at x in the reflected light sits at 2 x_m − x.
  const mirror: MirrorComponent | null =
    byKind(components, 'mirror')
      .filter((c) => c.x > source.x)
      .sort((a, b) => a.x - b.x)[0] ?? null
  const unfold = (x: number): number => (mirror ? 2 * mirror.x - x : x)
  const screenInPath = screen !== null && (mirror ? screen.x < mirror.x : screen.x > source.x)
  // Only components between the source and the screen (or the end of the
  // rail) are in the optical path.
  const pathEnd = screenInPath ? unfold(screen.x) : mirror ? unfold(0) : RAIL_LENGTH
  const forwardEnd = mirror ? mirror.x : pathEnd
  const target: ScreenComponent | null = screenInPath ? { ...screen, x: pathEnd } : null
  const inPath = <T extends BenchComponent>(list: T[]): T[] =>
    list.filter((c) => c.x > source.x && c.x < forwardEnd).sort((a, b) => a.x - b.x)
  const realLenses: LensComponent[] = inPath(byKind(components, 'lens'))
  const object: ObjectComponent | null = inPath(byKind(components, 'object'))[0] ?? null
  const slit: ApertureComponent | null =
    inPath<ApertureComponent>([...byKind(components, 'singleSlit'), ...byKind(components, 'doubleSlit')])[0] ?? null
  const grating: GratingComponent | null = inPath(byKind(components, 'grating'))[0] ?? null
  const pinhole: PinholeComponent | null = inPath(byKind(components, 'pinhole'))[0] ?? null
  const apertures = [slit, grating, pinhole].filter((c) => c !== null)

  // Ideal polarisers change the power only. With a mirror the light meets
  // those in front of it a second time on the way back to the screen.
  const polarizers: PolarizerComponent[] = inPath(byKind(components, 'polarizer'))
  if (mirror) {
    const returnEnd = screenInPath ? screen.x : -Infinity
    polarizers.push(
      ...byKind(components, 'polarizer')
        .filter((c) => c.x < mirror.x && c.x > returnEnd)
        .sort((a, b) => b.x - a.x),
    )
  }
  let polarization: PolarizationSolution | null = null
  if (polarizers.length > 0) {
    const chain = polarizerChain(polarizers.map((c) => c.angle))
    polarization = {
      transmission: chain.transmission,
      stages: polarizers.map((c, index) => ({ id: c.id, angle: c.angle, transmission: chain.stages[index] })),
      state: chain.state,
    }
    if (chain.transmission < 1e-9) {
      notices.push({ level: 'info', text: 'Crossed polarisers: no light is transmitted.' })
    }
  }
  const power = (source.kind === 'tungsten' ? source.intensity : 1) * (polarization?.transmission ?? 1)

  const solution: BenchSolution = {
    regime: 'illumination',
    model: 'geometric optics',
    source,
    wavelength,
    screenLight: null,
    notices,
    imaging: null,
    beam: null,
    diffraction: null,
    grating: null,
    airy: null,
    polarization,
    mirror: mirror ? { x: mirror.x, focalLength: mirror.focalLength, radius: 2 * mirror.focalLength } : null,
    overlay,
  }

  if (!screen) {
    notices.push({ level: 'info', text: 'Place the screen on the bench to observe the light.' })
  } else if (!screenInPath) {
    notices.push({
      level: 'warning',
      text: mirror
        ? 'The screen is behind the mirror; no light reaches it. Place it in front of the mirror to catch the reflected light.'
        : 'The screen is behind the light source; no light reaches it.',
    })
  }
  const darkScreen = (reason: string): ScreenLight | null =>
    screen
      ? { kind: 'dark', reason: screenInPath ? reason : mirror ? 'The screen is behind the mirror.' : 'The screen is behind the light source.' }
      : null

  const firstBlocker = Math.min(forwardEnd, realLenses[0]?.x ?? Infinity, object?.x ?? Infinity, ...apertures.map((c) => c.x))
  if (source.kind === 'tungsten') {
    const half = source.sourceSize / 2
    overlay.lampCone = {
      x0: source.x,
      x1: firstBlocker,
      halfHeight0: half,
      halfHeight1: Math.min(LAMP_FLOOD_MAX_HALF_HEIGHT, half + LAMP_FLOOD_HALF_ANGLE * (firstBlocker - source.x)),
    }
  }

  const unsupported = (reason: string, notice: string): BenchSolution => {
    solution.regime = 'unsupported'
    solution.model = 'none'
    solution.screenLight = screen ? { kind: 'unsupported', reason } : null
    notices.push({ level: 'error', text: notice })
    return solution
  }

  if (mirror) {
    // Light in front of the mirror passes every element twice; only free
    // space, an object and polarisers are modelled there.
    const returnEnd = screenInPath ? screen.x : 0
    const doublePass = components.some(
      (c) =>
        (c.kind === 'lens' || c.kind === 'singleSlit' || c.kind === 'doubleSlit' || c.kind === 'grating' || c.kind === 'pinhole') &&
        c.x < mirror.x &&
        c.x > Math.min(source.x, returnEnd),
    )
    if (doublePass) {
      return unsupported(
        'A lens or aperture stands in front of the mirror. Light passing it twice is not modelled.',
        'A mirror together with a lens, slit, grating or pinhole in front of it is not modelled. Remove one of them.',
      )
    }
    notices.push({
      level: 'info',
      text: 'The mirror sends the light back along the rail. As in the laboratory, it is taken to be tilted very slightly so that the returning light lands on a screen beside the object; the screen does not shadow the incoming light.',
    })
  }
  // On the unfolded axis the mirror is a thin lens of the same focal length.
  const lenses: LensComponent[] = mirror
    ? [{ id: mirror.id, kind: 'lens', x: mirror.x, focalLength: mirror.focalLength, aperture: mirror.aperture, concealed: false }]
    : realLenses

  if (apertures.length > 1) {
    return unsupported(
      'More than one slit, grating or pinhole is in the light path. This combination is not modelled.',
      'Only one diffracting element (slit, double slit, grating or pinhole) is modelled at a time. Remove the others.',
    )
  }
  if (apertures.length === 1 && object) {
    return unsupported(
      'An object and a diffracting aperture are both in the light path. This combination is not modelled.',
      'An object together with a slit, grating or pinhole is not modelled. Remove one of them: use the object for imaging experiments, or the aperture for diffraction.',
    )
  }

  if (slit) {
    solveDiffraction({ solution, source, slit, lenses, screen: target, pathEnd, power, options })
    if (!solution.screenLight) solution.screenLight = darkScreen('')
    return solution
  }
  if (grating) {
    solveGrating({ solution, source, grating, lenses, screen: target, pathEnd, power })
    if (!solution.screenLight) solution.screenLight = darkScreen('')
    return solution
  }
  if (pinhole) {
    solvePinhole({ solution, source, pinhole, lenses, screen: target, pathEnd, power })
    if (!solution.screenLight) solution.screenLight = darkScreen('')
    return solution
  }

  // --- Laser beam up to the first diffusing surface --------------------------
  let illuminationRadius: number | null = null
  if (source.kind === 'laser') {
    const beamEnd = object ? object.x : pathEnd
    const path = propagateBeam(lenses, wavelength!, HENE_WAIST_RADIUS, source.x, beamEnd)
    solution.beam = beamSolution(source, path, !object && screenInPath ? path.radiusAtEnd : null)
    overlay.beam = path.samples
    for (const lens of lensesBetween(lenses, source.x, beamEnd)) {
      const radiusAtLens = propagateBeam(lenses, wavelength!, HENE_WAIST_RADIUS, source.x, lens.x).radiusAtEnd
      if (radiusAtLens > lens.aperture / 3) {
        notices.push({
          level: 'warning',
          text: `The laser beam is clipped by the ${mirror ? 'mirror' : 'lens'} aperture; the Gaussian-beam model ignores this truncation.`,
        })
        break
      }
    }
    if (!object) {
      solution.regime = 'beam'
      solution.model = 'Gaussian beam optics'
      solution.screenLight = screenInPath
        ? { kind: 'spot', rgb: lightRgb, level: power, radius: path.radiusAtEnd }
        : darkScreen('')
      return foldAtMirror(solution, mirror)
    }
    illuminationRadius = path.radiusAtEnd
    notices.push({
      level: 'info',
      text: 'The laser lights only a spot about 1 mm wide on the object. Use the tungsten lamp to illuminate the whole object.',
    })
  }

  // --- Geometric imaging ------------------------------------------------------
  let luminous: LuminousObject | null = null
  if (object) {
    luminous = {
      x: object.x,
      height: object.height,
      shape: object.shape,
      letter: object.letter,
      anchor: 'base',
      illuminationRadius,
    }
    if (source.kind === 'tungsten' && lensesBetween(lenses, source.x, object.x).length > 0) {
      notices.push({
        level: 'info',
        text: 'A lens between the lamp and the object acts as a condenser. It changes the illumination only; uniform illumination of the object is assumed.',
      })
    }
  } else if (source.kind === 'tungsten') {
    // With no object in the path the lamp's emitting aperture is itself the object.
    luminous = {
      x: source.x,
      height: source.sourceSize,
      shape: 'disc',
      letter: '',
      anchor: 'center',
      illuminationRadius: null,
    }
  }

  if (luminous) {
    solveImaging({ solution, luminous, lenses, screen: target, pathEnd, power, isLamp: !object, element: mirror ? 'mirror' : 'lens' })
    if (!solution.screenLight) solution.screenLight = darkScreen('')
  }
  return foldAtMirror(solution, mirror)
}

/**
 * Maps the drawing geometry computed on the unfolded axis back onto the rail:
 * everything beyond the mirror plane belongs to the reflected light.
 */
function foldAtMirror(solution: BenchSolution, mirror: MirrorComponent | null): BenchSolution {
  if (!mirror) return solution
  const { overlay } = solution
  const fold = (x: number): number => (x > mirror.x ? 2 * mirror.x - x : x)
  const reflect = (point: Point): Point => ({ x: 2 * mirror.x - point.x, y: point.y })
  if (overlay.beam) {
    const samples = overlay.beam
    overlay.beam = samples.filter((sample) => sample.x <= mirror.x)
    overlay.reflectedBeam = samples
      .filter((sample) => sample.x >= mirror.x)
      .map((sample) => ({ x: fold(sample.x), w: sample.w }))
      .reverse()
  }
  if (overlay.bundle) {
    overlay.bundle = {
      upper: overlay.bundle.upper.map((point) => ({ x: fold(point.x), y: point.y })),
      lower: overlay.bundle.lower.map((point) => ({ x: fold(point.x), y: point.y })),
    }
  }
  // Everything after the reflection, including a virtual image behind the
  // mirror, lies in the mirrored half of the unfolded axis.
  overlay.principalRays = overlay.principalRays.map((ray) => ({
    ...ray,
    outgoing: { from: reflect(ray.outgoing.from), to: reflect(ray.outgoing.to) },
    virtualExtension: ray.virtualExtension
      ? { from: reflect(ray.virtualExtension.from), to: reflect(ray.virtualExtension.to) }
      : null,
  }))
  overlay.images = overlay.images.map((image) => ({ ...image, x: 2 * mirror.x - image.x }))
  return solution
}

function beamSolution(source: LaserComponent, path: BeamPath, radiusAtScreen: number | null): BeamSolution {
  const wavelength = laserLine(source.lineId).wavelength
  return {
    wavelength,
    waistRadius: HENE_WAIST_RADIUS,
    rayleighRange: rayleighRange(HENE_WAIST_RADIUS, wavelength),
    divergenceHalfAngle: divergenceHalfAngle(HENE_WAIST_RADIUS, wavelength),
    path,
    radiusAtScreen,
  }
}

interface ImagingArgs {
  solution: BenchSolution
  luminous: LuminousObject
  lenses: LensComponent[]
  screen: ScreenComponent | null
  pathEnd: number
  power: number
  isLamp: boolean
  element: 'lens' | 'mirror'
}

function solveImaging({ solution, luminous, lenses, screen, pathEnd, power, isLamp, element }: ImagingArgs): void {
  const { overlay, notices } = solution
  const imagingLenses = lensesBetween(lenses, luminous.x, pathEnd)
  // Height of the point used for ray diagrams: the tip of the object.
  const tipHeight = luminous.anchor === 'center' ? luminous.height / 2 : luminous.height
  const rgb = overlay.lightRgb

  solution.model = 'geometric optics'

  if (imagingLenses.length === 0) {
    solution.regime = 'illumination'
    solution.imaging = isLamp
      ? null
      : { element, objectX: luminous.x, objectHeight: luminous.height, sequence: null, imageHeight: null, screen: null }
    // A diffusing surface sends light in every direction: each of its points
    // lights the whole screen. Drawn from the lit part of the object out to
    // the full height of the screen.
    const lit =
      luminous.illuminationRadius !== null
        ? { top: luminous.illuminationRadius, bottom: -luminous.illuminationRadius }
        : luminous.anchor === 'center'
          ? { top: luminous.height / 2, bottom: -luminous.height / 2 }
          : { top: luminous.height, bottom: 0 }
    if (!isLamp) {
      overlay.bundle = {
        upper: [{ x: luminous.x, y: lit.top }, { x: pathEnd, y: SCREEN_HALF_SIZE }],
        lower: [{ x: luminous.x, y: lit.bottom }, { x: pathEnd, y: -SCREEN_HALF_SIZE }],
      }
    }
    if (screen) {
      // Diffuse light from an area A falls on the whole screen: E = L A / s².
      // Shown relative to the irradiance a standard lens would deliver at the
      // same distance, E_ref = L π D² / (4 s²).
      const area = shapeFillFraction(luminous.shape) * luminous.height ** 2
      const reference = (Math.PI * DEFAULT_LENS_APERTURE ** 2) / 4
      solution.screenLight = { kind: 'uniform', rgb, level: Math.min(1, area / reference) * power }
      notices.push({
        level: 'info',
        text: 'No lens between the object and the screen: every point of the source lights the whole screen, so no image forms.',
      })
    }
    return
  }

  solution.regime = 'imaging'
  const sequence = sequentialImaging(imagingLenses, luminous.x)!
  const imageHeight = sequence.atInfinity ? null : sequence.magnification * tipHeight
  solution.imaging = {
    element,
    objectX: luminous.x,
    objectHeight: tipHeight,
    sequence,
    imageHeight,
    screen: null,
  }

  // Image markers and principal rays, stage by stage.
  let stageObjectX = luminous.x
  let stageObjectHeight = tipHeight
  sequence.stages.forEach((stage, index) => {
    const isFinal = index === sequence.stages.length - 1
    const stageEnd = isFinal ? pathEnd : imagingLenses[index + 1].x
    if (stage.objectDistance > 0 && Number.isFinite(stageObjectHeight)) {
      overlay.principalRays.push(
        ...principalRays(stage.lensX, stage.focalLength, stageObjectX, stageObjectHeight, stageEnd),
      )
    }
    stageObjectX = stage.imageX
    stageObjectHeight *= stage.magnification
    if (Number.isFinite(stage.imageX) && Number.isFinite(stageObjectHeight)) {
      overlay.images.push({ x: stage.imageX, height: stageObjectHeight, isReal: stage.isReal, isFinal })
    }
  })

  const projection = screen ? projectOntoScreen(imagingLenses, luminous.x, screen.x) : null
  const bundleProbe = projection ?? projectOntoScreen(imagingLenses, luminous.x, pathEnd)
  if (bundleProbe) {
    overlay.bundle = {
      upper: traceRay(imagingLenses, luminous.x, pathEnd, 0, bundleProbe.marginalSlope),
      lower: traceRay(imagingLenses, luminous.x, pathEnd, 0, -bundleProbe.marginalSlope),
    }
  }

  if (screen && projection) {
    const lastLens = imagingLenses[imagingLenses.length - 1]
    const inFocus = projection.blurDiameter < SHARP_BLUR_LIMIT
    solution.imaging.screen = {
      distance: screen.x - lastLens.x,
      scale: projection.scale,
      blurDiameter: projection.blurDiameter,
      inFocus,
      irradiancePerRadiance: (Math.PI * projection.marginalSlope ** 2) / projection.scale ** 2,
    }
    solution.screenLight = {
      kind: 'image',
      rgb,
      level: power,
      shape: luminous.shape,
      letter: luminous.letter,
      objectHeight: luminous.height,
      anchor: luminous.anchor,
      scale: projection.scale,
      blurDiameter: projection.blurDiameter,
      illuminationRadius: luminous.illuminationRadius,
    }
    if (!sequence.isReal) {
      notices.push({
        level: 'info',
        text: `The image is virtual: the light leaving the ${element} diverges, so no sharp image can be caught on a screen.`,
      })
    }
  }
}

interface DiffractionArgs {
  solution: BenchSolution
  source: SourceComponent
  slit: ApertureComponent
  lenses: LensComponent[]
  screen: ScreenComponent | null
  pathEnd: number
  power: number
  options: SolveOptions
}

function solveDiffraction(args: DiffractionArgs): void {
  const { solution, source, slit, lenses, screen, pathEnd, power, options } = args
  const { overlay, notices } = solution
  const separation = slit.kind === 'doubleSlit' ? slit.separation : null
  const halfExtent = apertureHalfExtent(slit.width, separation)
  const lensesAfter = lensesBetween(lenses, slit.x, pathEnd)
  const freeSpace = lensesAfter.length === 0

  solution.regime = 'diffraction'
  solution.model = 'wave optics'

  // --- Illumination of the slit ---------------------------------------------
  let lines: SpectralLine[]
  let referenceWavelength: number
  let radiusOfCurvature: number
  let beamRadiusAtSlit: number | null = null
  /** Angular size of the source as seen from the slit (incoherent smearing). */
  let sourceAngularSize = 0
  let fullBeam: BeamPath | null = null

  if (source.kind === 'laser') {
    referenceWavelength = laserLine(source.lineId).wavelength
    lines = [{ wavelength: referenceWavelength, rgb: overlay.lightRgb }]
    const toSlit = propagateBeam(lenses, referenceWavelength, HENE_WAIST_RADIUS, source.x, slit.x)
    radiusOfCurvature = wavefrontRadius(toSlit.qEnd)
    beamRadiusAtSlit = toSlit.radiusAtEnd
    fullBeam = propagateBeam(lenses, referenceWavelength, HENE_WAIST_RADIUS, source.x, pathEnd)
    solution.beam = beamSolution(source, toSlit, null)
    // A vertical slit spreads light horizontally, out of the plane of the side
    // view, where the beam keeps its unobstructed Gaussian profile.
    overlay.beam = slit.orientation === 'vertical' ? fullBeam.samples : toSlit.samples
    if (halfExtent > 0.7 * beamRadiusAtSlit) {
      notices.push({
        level: 'warning',
        text:
          separation !== null
            ? 'The laser beam is too narrow to illuminate both slits evenly. The model assumes uniform illumination; move the slits farther from the laser or reduce the separation.'
            : 'The slit is wider than the uniform part of the laser beam. The model assumes uniform illumination of the slit.',
      })
    }
  } else {
    referenceWavelength = WHITE_LIGHT_REFERENCE_WAVELENGTH
    lines = blackbodySpectrum(TUNGSTEN_TEMPERATURE)
    const [, sourceB, , sourceD] = systemMatrix(lenses, source.x, slit.x)
    radiusOfCurvature = Math.abs(sourceD) < 1e-12 ? Infinity : sourceB / sourceD
    sourceAngularSize = source.sourceSize / Math.max(Math.abs(sourceB), 1e-6)
    notices.push({
      level: 'info',
      text: 'Tungsten light is broadband and comes from an extended source: each wavelength and each source point makes its own pattern, and they add in intensity. Fringes are coloured and wash out unless the source is small or far away.',
    })
  }

  const fanAngle = singleSlitMinimumAngle(slit.width, referenceWavelength) ?? Math.PI / 2
  overlay.fan = {
    x: slit.x,
    xEnd: lensesAfter[0]?.x ?? pathEnd,
    halfAngle: fanAngle,
    inViewPlane: slit.orientation === 'horizontal',
  }

  if (!screen) return

  const [A, B] = systemMatrix(lenses, slit.x, screen.x)
  const magnificationM = A + (Number.isFinite(radiusOfCurvature) ? B / radiusOfCurvature : 0)
  const effectiveDistance = Math.abs(magnificationM) < 1e-12 ? Infinity : B / magnificationM
  const fresnelNum = Number.isFinite(effectiveDistance)
    ? fresnelNumber(halfExtent, referenceWavelength, Math.max(Math.abs(effectiveDistance), 1e-12))
    : 0
  const regime = classifyRegime(fresnelNum)
  const smearWidth = sourceAngularSize * Math.abs(B)
  const absB = Math.abs(B)

  solution.diffraction = {
    kind: separation === null ? 'single' : 'double',
    polychromatic: source.kind === 'tungsten',
    wavelength: referenceWavelength,
    slitWidth: slit.width,
    separation,
    distance: screen.x - slit.x,
    effectiveB: B,
    fresnelNumber: fresnelNum,
    regime,
    model: options.diffractionModel,
    firstMinimumAngle: singleSlitMinimumAngle(slit.width, referenceWavelength),
    centralMaximumWidth: freeSpace
      ? centralMaximumWidth(slit.width, referenceWavelength, absB)
      : (2 * referenceWavelength * absB) / slit.width,
    fringeSpacing: separation === null ? null : fringeSpacing(separation, referenceWavelength, absB),
    fringeAngularSpacing: separation === null ? null : fringeAngularSpacing(separation, referenceWavelength),
    fringesInCentralMaximum: separation === null ? null : fringesInCentralMaximum(slit.width, separation),
    smearWidth,
    beamRadiusAtSlit,
  }

  if (options.diffractionModel === 'fraunhofer') {
    if (absB < 1e-9) {
      solution.screenLight = {
        kind: 'unsupported',
        reason: 'The screen is in the image plane of the slit. The Fraunhofer model does not apply here; switch to the Fresnel model.',
      }
      notices.push({ level: 'error', text: 'Fraunhofer diffraction is undefined at the image plane of the slit.' })
      return
    }
    if (regime === 'near-field') {
      notices.push({
        level: 'error',
        text: `Fresnel number N_F = ${fresnelNum.toFixed(2)} ≥ 1: the screen is in the near field and the Fraunhofer formula shown is NOT valid here. Move the screen away, narrow the slit, or switch to the Fresnel model.`,
      })
    } else if (regime === 'marginal') {
      notices.push({
        level: 'warning',
        text: `Fresnel number N_F = ${fresnelNum.toFixed(2)}: the far-field condition N_F ≪ 1 is only marginally met, so the Fraunhofer pattern is approximate.`,
      })
    }
  } else if (regime !== 'far-field') {
    notices.push({
      level: 'info',
      text: `Near-field geometry (N_F = ${fresnelNum.toFixed(2)}): the pattern is computed with Fresnel diffraction.`,
    })
  }

  const pattern = buildSlitPattern({
    slitWidth: slit.width,
    separation,
    lines,
    A,
    B,
    freeSpace,
    wavefrontRadius: radiusOfCurvature,
    model: options.diffractionModel,
    smearWidth,
    power,
  })

  solution.screenLight = {
    kind: 'fringes',
    pattern,
    orientation: slit.orientation,
    band: fullBeam
      ? { profile: 'gaussian', radius: fullBeam.radiusAtEnd }
      : {
          profile: 'flat',
          halfHeight: (SLIT_LENGTH / 2) * Math.max(Math.abs(magnificationM), 1e-3) + smearWidth / 2,
          edge: Math.max(smearWidth, mm(0.5)),
        },
  }
}

interface GratingArgs {
  solution: BenchSolution
  source: SourceComponent
  grating: GratingComponent
  lenses: LensComponent[]
  screen: ScreenComponent | null
  pathEnd: number
  power: number
}

function solveGrating({ solution, source, grating, lenses, screen, pathEnd, power }: GratingArgs): void {
  const { overlay, notices } = solution
  const period = gratingPeriod(grating.lineDensity)
  const distance = screen ? screen.x - grating.x : null
  const inViewPlane = grating.orientation === 'horizontal'

  solution.regime = 'diffraction'
  solution.model = 'wave optics'

  if (lensesBetween(lenses, grating.x, pathEnd).length > 0) {
    solution.regime = 'unsupported'
    solution.model = 'none'
    solution.screenLight = screen
      ? {
          kind: 'unsupported',
          reason: 'A lens stands behind the grating. The thin-lens model is paraxial and does not hold at the large angles of a grating.',
        }
      : null
    notices.push({
      level: 'error',
      text: 'A lens between the grating and the screen is not modelled: grating orders leave at tens of degrees, far outside the paraxial range of the thin-lens model. Place the lens in front of the grating, or remove it.',
    })
    return
  }

  const referenceWavelength = source.kind === 'laser' ? laserLine(source.lineId).wavelength : WHITE_LIGHT_REFERENCE_WAVELENGTH
  const orders = (count: number) => {
    const list = []
    for (let order = 0; order <= count; order++) {
      const angle = orderAngle(order, period, referenceWavelength)
      if (angle === null) break
      const position = distance === null ? null : distance * Math.tan(angle)
      list.push({
        order,
        angle,
        position,
        efficiency: orderEfficiency(order, GRATING_OPEN_FRACTION),
        onScreen: position !== null && Math.abs(position) <= SCREEN_HALF_SIZE,
      })
    }
    return list
  }
  const reported = orders(Math.min(GRATING_MAX_ORDER, highestOrder(period, referenceWavelength)))
  overlay.orders = {
    x: grating.x,
    xEnd: pathEnd,
    inViewPlane,
    rays: reported.flatMap((entry) => {
      const strength = entry.efficiency / reported[0].efficiency
      return entry.order === 0
        ? [{ order: 0, angle: 0, strength }]
        : [
            { order: entry.order, angle: entry.angle, strength },
            { order: -entry.order, angle: -entry.angle, strength },
          ]
    }),
  }

  if (source.kind === 'laser') {
    const toGrating = propagateBeam(lenses, referenceWavelength, HENE_WAIST_RADIUS, source.x, grating.x)
    const radius = toGrating.radiusAtEnd
    const illuminatedLines = (2 * radius) / period
    solution.beam = beamSolution(source, toGrating, null)
    overlay.beam = toGrating.samples
    solution.grating = {
      lineDensity: grating.lineDensity,
      period,
      polychromatic: false,
      wavelength: referenceWavelength,
      distance,
      illuminatedLines,
      orders: reported,
      beamRadiusAtGrating: radius,
    }
    if (grating.aperture < 3 * radius) {
      notices.push({
        level: 'warning',
        text: 'The laser beam is wider than the open part of the grating. The model ignores this truncation of the beam.',
      })
    }
    if (illuminatedLines < 10) {
      notices.push({
        level: 'warning',
        text: `The beam covers only about ${illuminatedLines.toFixed(0)} grating lines. The model treats each order as a copy of the beam, which requires many lines.`,
      })
    }
    if (!screen || distance === null) return
    const spots = laserOrderSpots({
      period,
      wavelength: referenceWavelength,
      openFraction: GRATING_OPEN_FRACTION,
      q: toGrating.qEnd,
      distance,
      maxOrder: GRATING_MAX_ORDER,
    })
    solution.screenLight = {
      kind: 'spots',
      rgb: overlay.lightRgb,
      level: power,
      orientation: grating.orientation,
      spots: spots.map((spot) => ({
        position: spot.position,
        radiusAlong: spot.radiusAlong,
        radiusAcross: spot.radiusAcross,
        level: spot.level,
      })),
    }
    return
  }

  const [, sourceB, , sourceD] = systemMatrix(lenses, source.x, grating.x)
  const radiusOfCurvature = Math.abs(sourceD) < 1e-12 ? Infinity : sourceB / sourceD
  solution.grating = {
    lineDensity: grating.lineDensity,
    period,
    polychromatic: true,
    wavelength: referenceWavelength,
    distance,
    illuminatedLines: grating.aperture / period,
    orders: reported,
    beamRadiusAtGrating: null,
  }
  notices.push({
    level: 'info',
    text: 'Tungsten light is broadband: the grating sends each wavelength to its own angle, so every order except the zeroth is a spectrum. Its sharpness is limited by the open width of the grating and by the size of the lamp aperture.',
  })
  if (!screen || distance === null) return

  const pattern = buildGratingSpectrum({
    period,
    openFraction: GRATING_OPEN_FRACTION,
    lines: blackbodySpectrum(TUNGSTEN_TEMPERATURE, 100),
    distance,
    aperture: grating.aperture,
    referenceAperture: GRATING_APERTURE,
    wavefrontRadius: radiusOfCurvature,
    sourceB,
    sourceSize: source.sourceSize,
    power,
    maxOrder: GRATING_MAX_ORDER,
  })
  const smear = (source.sourceSize * distance) / Math.max(Math.abs(sourceB), 1e-6)
  solution.screenLight = {
    kind: 'fringes',
    pattern,
    orientation: grating.orientation,
    band: {
      profile: 'flat',
      halfHeight: (SLIT_LENGTH / 2) * Math.max(Math.abs(pattern.transverseMagnification), 1e-3) + smear / 2,
      edge: Math.max(smear, mm(0.5)),
    },
  }
}

interface PinholeArgs {
  solution: BenchSolution
  source: SourceComponent
  pinhole: PinholeComponent
  lenses: LensComponent[]
  screen: ScreenComponent | null
  pathEnd: number
  power: number
}

function solvePinhole({ solution, source, pinhole, lenses, screen, pathEnd, power }: PinholeArgs): void {
  const { overlay, notices } = solution

  if (source.kind !== 'laser') {
    solution.regime = 'unsupported'
    solution.model = 'none'
    solution.screenLight = screen
      ? { kind: 'unsupported', reason: 'The tungsten lamp behind a circular aperture is not modelled. Use the He-Ne laser.' }
      : null
    notices.push({
      level: 'error',
      text: 'White light from an extended source through a circular aperture is not modelled. Use the He-Ne laser for the circular-aperture experiment.',
    })
    return
  }

  solution.regime = 'diffraction'
  solution.model = 'wave optics'
  const wavelength = laserLine(source.lineId).wavelength
  const radius = pinhole.diameter / 2
  const toAperture = propagateBeam(lenses, wavelength, HENE_WAIST_RADIUS, source.x, pinhole.x)
  const lensesAfter = lensesBetween(lenses, pinhole.x, pathEnd)
  solution.beam = beamSolution(source, toAperture, null)
  overlay.beam = toAperture.samples
  const firstZeroAngle = airyFirstZeroAngle(pinhole.diameter, wavelength)
  overlay.fan = { x: pinhole.x, xEnd: lensesAfter[0]?.x ?? pathEnd, halfAngle: firstZeroAngle ?? Math.PI / 2, inViewPlane: true }
  if (radius > 0.7 * toAperture.radiusAtEnd) {
    notices.push({
      level: 'warning',
      text: 'The aperture is wider than the uniform part of the laser beam. The model assumes uniform illumination of the aperture.',
    })
  }
  if (!screen) return

  const [A, B] = systemMatrix(lenses, pinhole.x, screen.x)
  const wavefront = wavefrontRadius(toAperture.qEnd)
  const magnificationM = A + (Number.isFinite(wavefront) ? B / wavefront : 0)
  const effectiveDistance = Math.abs(magnificationM) < 1e-12 ? Infinity : B / magnificationM
  const fresnelNum = Number.isFinite(effectiveDistance)
    ? fresnelNumber(radius, wavelength, Math.max(Math.abs(effectiveDistance), 1e-12))
    : 0
  const regime = classifyRegime(fresnelNum)
  const absB = Math.abs(B)
  const freeSpace = lensesAfter.length === 0

  solution.airy = {
    wavelength,
    diameter: pinhole.diameter,
    distance: screen.x - pinhole.x,
    effectiveB: B,
    fresnelNumber: fresnelNum,
    regime,
    firstZeroAngle,
    firstDarkRingRadius:
      freeSpace && firstZeroAngle !== null ? absB * Math.tan(firstZeroAngle) : airyDiscRadius(pinhole.diameter, wavelength, absB),
    beamRadiusAtAperture: toAperture.radiusAtEnd,
  }

  if (absB < 1e-9) {
    solution.screenLight = {
      kind: 'unsupported',
      reason: 'The screen is in the image plane of the aperture. The Fraunhofer model does not apply here.',
    }
    notices.push({ level: 'error', text: 'Fraunhofer diffraction is undefined at the image plane of the aperture.' })
    return
  }
  if (regime === 'near-field') {
    notices.push({
      level: 'error',
      text: `Fresnel number N_F = ${fresnelNum.toFixed(2)} ≥ 1: the screen is in the near field and the Airy pattern shown is NOT valid here. Move the screen away or use a smaller aperture.`,
    })
  } else if (regime === 'marginal') {
    notices.push({
      level: 'warning',
      text: `Fresnel number N_F = ${fresnelNum.toFixed(2)}: the far-field condition N_F ≪ 1 is only marginally met, so the Airy pattern is approximate.`,
    })
  }

  solution.screenLight = {
    kind: 'field',
    rgb: overlay.lightRgb,
    level: power,
    intensity: (u, v) => {
      const r = Math.hypot(u, v)
      return airyIntensity(pinhole.diameter, wavelength, freeSpace ? r / Math.hypot(r, B) : r / absB)
    },
  }
}
