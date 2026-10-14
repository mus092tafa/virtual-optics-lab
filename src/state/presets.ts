/**
 * Bench layouts for the predefined experiments. Positions are physical
 * (metres along the rail) and built through the unit helpers.
 */
import { CONDITION_ASTIGMATISM, DEFAULT_LENS_APERTURE, DEFAULT_MIRROR_APERTURE, DEFAULT_PINHOLE_DIAMETER, DEFAULT_VERTEX_DISTANCE, EYE, GRATING_APERTURE } from '../physics/constants'
import { NORMAL_AXIAL_LENGTH, axialLengthFor, cornealPower, cornealRadiusFor } from '../physics/eye'
import type { EyeSetup } from '../physics/eye'
import type { BenchComponent, ComponentKind } from '../physics/types'
import { cm, degToRad, mm, perMm } from '../physics/units'
import type { SurfaceSetup } from '../physics/surface'

export type ExperimentId =
  | 'reflection'
  | 'refraction'
  | 'convex-lens'
  | 'magnification'
  | 'hene-lens'
  | 'single-slit'
  | 'double-slit'
  | 'tungsten'
  | 'michelson'
  | 'concave-lens'
  | 'grating'
  | 'airy'
  | 'malus'
  | 'brewster'
  | 'prism'
  | 'concave-mirror'
  | 'eye-accommodation'
  | 'eye-glasses'
  | 'eye-ageing'
  | 'eye-astigmatism'
  | 'eye-chromatic'
  | 'eye-spherical'

export interface BenchView {
  /** Visible part of the rail, metres. */
  x0: number
  x1: number
}

export interface BenchPreset {
  components: BenchComponent[]
  view: BenchView
  /** Width of the screen area shown in the output panel. */
  screenFov: number
}

/** Space shown to the left of the rail's zero so that source housings are visible. */
const VIEW_MARGIN = cm(7)

let nextId = 1
export function createId(kind: string): string {
  return `${kind}-${Date.now().toString(36)}-${nextId++}`
}

/** A new component of the given kind with sensible laboratory defaults. */
export function createComponent(kind: ComponentKind, x: number): BenchComponent {
  const id = createId(kind)
  switch (kind) {
    case 'laser':
      return { id, kind, x, lineId: 'red' }
    case 'tungsten':
      return { id, kind, x, intensity: 0.7, sourceSize: mm(4) }
    case 'lens':
      return { id, kind, x, focalLength: cm(10), aperture: DEFAULT_LENS_APERTURE, concealed: false }
    case 'singleSlit':
      return { id, kind, x, width: mm(0.1), orientation: 'vertical' }
    case 'doubleSlit':
      return { id, kind, x, width: mm(0.04), separation: mm(0.25), orientation: 'vertical' }
    case 'grating':
      return { id, kind, x, lineDensity: perMm(300), aperture: GRATING_APERTURE, orientation: 'vertical' }
    case 'pinhole':
      return { id, kind, x, diameter: DEFAULT_PINHOLE_DIAMETER }
    case 'polarizer':
      return { id, kind, x, angle: 0 }
    case 'mirror':
      return { id, kind, x, focalLength: cm(20), aperture: DEFAULT_MIRROR_APERTURE }
    case 'object':
      return { id, kind, x, shape: 'arrow', height: mm(20), letter: 'F' }
    case 'screen':
      return { id, kind, x }
  }
}

function make<K extends ComponentKind>(
  kind: K,
  x: number,
  overrides: Partial<Extract<BenchComponent, { kind: K }>> = {},
): BenchComponent {
  return { ...createComponent(kind, x), ...overrides } as BenchComponent
}

export function benchPreset(id: ExperimentId): BenchPreset | null {
  switch (id) {
    case 'convex-lens':
      // f = 10 cm, do = 30 cm -> image at 15 cm. The screen starts out of focus
      // so that the student has to find the image plane.
      return {
        components: [
          make('tungsten', cm(5)),
          make('object', cm(15), { shape: 'arrow', height: mm(20) }),
          make('lens', cm(45), { focalLength: cm(10) }),
          make('screen', cm(72)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(90) },
        screenFov: mm(80),
      }
    case 'magnification':
      // f = 15 cm, do = 22.5 cm -> di = 45 cm, m = −2.
      return {
        components: [
          make('tungsten', cm(5)),
          make('object', cm(15), { shape: 'letter', letter: 'F', height: mm(15) }),
          make('lens', cm(37.5), { focalLength: cm(15) }),
          make('screen', cm(82.5)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(100) },
        screenFov: mm(120),
      }
    case 'hene-lens':
      return {
        components: [make('laser', cm(8)), make('lens', cm(40), { focalLength: cm(10) }), make('screen', cm(70))],
        view: { x0: -VIEW_MARGIN, x1: cm(90) },
        screenFov: mm(10),
      }
    case 'single-slit':
      return {
        components: [make('laser', cm(8)), make('singleSlit', cm(30), { width: mm(0.1) }), make('screen', cm(140))],
        view: { x0: -VIEW_MARGIN, x1: cm(150) },
        screenFov: mm(80),
      }
    case 'double-slit':
      return {
        components: [
          make('laser', cm(8)),
          make('doubleSlit', cm(30), { width: mm(0.04), separation: mm(0.25) }),
          make('screen', cm(140)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(150) },
        screenFov: mm(60),
      }
    case 'tungsten':
      // f = 20 cm, do = di = 40 cm, m = −1.
      return {
        components: [
          make('tungsten', cm(5), { intensity: 0.6 }),
          make('object', cm(15), { shape: 'cross', height: mm(20) }),
          make('lens', cm(55), { focalLength: cm(20) }),
          make('screen', cm(95)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(110) },
        screenFov: mm(80),
      }
    case 'concave-lens':
      // Convex f = 10 cm, do = 20 cm -> image 20 cm behind it (x = 55 cm). The
      // concave lens (f = −15 cm) at x = 45 cm meets that converging light
      // 10 cm before its focus and moves the image to 30 cm behind itself.
      return {
        components: [
          make('tungsten', cm(5)),
          make('object', cm(15), { shape: 'arrow', height: mm(10) }),
          make('lens', cm(35), { focalLength: cm(10) }),
          make('lens', cm(45), { focalLength: -cm(15) }),
          make('screen', cm(70)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(95) },
        screenFov: mm(80),
      }
    case 'grating':
      // 300 lines/mm, λ = 632.8 nm: θ₁ = 10.94°, first order 48.3 mm off axis at L = 25 cm.
      return {
        components: [make('laser', cm(8)), make('grating', cm(100), { lineDensity: perMm(300) }), make('screen', cm(125))],
        view: { x0: -VIEW_MARGIN, x1: cm(140) },
        screenFov: mm(120),
      }
    case 'airy':
      // D = 0.2 mm, L = 110 cm: first dark ring radius 1.22 λ L / D = 4.25 mm.
      return {
        components: [make('laser', cm(8)), make('pinhole', cm(30), { diameter: mm(0.2) }), make('screen', cm(140))],
        view: { x0: -VIEW_MARGIN, x1: cm(150) },
        screenFov: mm(30),
      }
    case 'malus':
      return {
        components: [
          make('laser', cm(8)),
          make('polarizer', cm(35), { angle: 0 }),
          make('polarizer', cm(60), { angle: degToRad(30) }),
          make('screen', cm(90)),
        ],
        view: { x0: -VIEW_MARGIN, x1: cm(105) },
        screenFov: mm(10),
      }
    case 'concave-mirror':
      // f = 20 cm (R = 40 cm), do = 30 cm -> di = 60 cm, m = −2. The screen
      // starts out of focus so that the student has to find the image plane.
      return {
        components: [
          make('tungsten', cm(45)),
          make('object', cm(70), { shape: 'arrow', height: mm(12) }),
          make('mirror', cm(100), { focalLength: cm(20) }),
          make('screen', cm(48)),
        ],
        view: { x0: cm(15), x1: cm(115) },
        screenFov: mm(80),
      }
    default:
      return null
  }
}

export function surfacePreset(id: ExperimentId): SurfaceSetup | null {
  switch (id) {
    case 'reflection':
      return { kind: 'mirror', surfaceTilt: 0, sourceAngle: degToRad(90 + 35), medium1: 'air', medium2: 'air', polarization: 'unpolarized' }
    case 'refraction':
      return { kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(90 + 40), medium1: 'air', medium2: 'water', polarization: 'unpolarized' }
    case 'brewster':
      return { kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(90 + 40), medium1: 'air', medium2: 'crown', polarization: 'p' }
    default:
      return null
  }
}

/** Prism on the spectrometer table (Section A): angles in radians. */
export interface PrismSetting {
  apexAngle: number
  incidenceAngle: number
  glassId: string
  /** A He-Ne line id, or 'white' for a fan of wavelengths. */
  light: string
}

export const DEFAULT_PRISM: PrismSetting = {
  apexAngle: degToRad(60),
  incidenceAngle: degToRad(60),
  glassId: 'bk7',
  light: 'red',
}

export type EyeChart = 'letters' | 'text' | 'face' | 'fan'

/** The schematic eye, its object and its glasses (lengths in metres, powers in dioptres). */
export interface EyeSetting {
  axialLength: number
  cornealRadius: number
  /** Years. */
  age: number
  pupilDiameter: number
  /** Object to cornea; null for a distant object. */
  objectDistance: number | null
  /** Height of one letter of the chart at a finite distance. */
  letterHeight: number
  /** Angle one letter of a distant chart subtends, radians. */
  letterAngle: number
  chart: EyeChart
  /** Width of the part of the retina shown in the image panel. */
  fieldOfView: number
  /** Accommodation the lens is held at; null lets the eye accommodate by itself. */
  heldAccommodation: number | null
  glassesOn: boolean
  glassesPower: number
  vertexDistance: number
  /** Age of a second, otherwise identical eye shown beside the first; null for none. */
  compareAge: number | null
  /** When true the length, the cornea, its shape and the age of the eye are hidden from the student ("unknown eye"). */
  concealed: boolean
  /** Radius of the cornea in the meridian at right angles to the first; null for a cornea with one radius. */
  cornealRadiusCross: number | null
  /** Direction of the first meridian, radians counter-clockwise from the horizontal as seen facing the eye. */
  cornealMeridian: number
  /** Cylinder of the glasses, dioptres, and its axis in radians. */
  glassesCylinder: number
  glassesAxis: number
  /** Wavelength of the light on the chart; null for white light. */
  wavelength: number | null
  /** The indices of the eye follow the wavelength (chromatic aberration). */
  dispersion: boolean
  /** Real rays are traced instead of paraxial ones (spherical aberration). */
  realRays: boolean
  /** Ring stop in the pupil: inner radius of the open ring as a fraction of the pupil's radius; 0 for an open pupil. */
  pupilZone: number
  /** Asphericity Q of the cornea and of both lens surfaces. */
  cornealAsphericity: number
  lensAsphericity: number
  /** Which view of the eye the scene shows. */
  sceneView: EyeSceneView
}

export type EyeSceneView = 'side' | 'top' | 'both' | 'front'


const ARC_MINUTE = degToRad(1 / 60)

export const DEFAULT_EYE: EyeSetting = {
  axialLength: NORMAL_AXIAL_LENGTH,
  cornealRadius: EYE.cornealRadius,
  age: 20,
  pupilDiameter: mm(4),
  objectDistance: cm(50),
  letterHeight: mm(1.5),
  letterAngle: 10 * ARC_MINUTE,
  chart: 'letters',
  fieldOfView: mm(1),
  heldAccommodation: null,
  glassesOn: false,
  glassesPower: 0,
  vertexDistance: DEFAULT_VERTEX_DISTANCE,
  compareAge: null,
  concealed: false,
  cornealRadiusCross: null,
  cornealMeridian: 0,
  glassesCylinder: 0,
  glassesAxis: 0,
  wavelength: null,
  dispersion: false,
  realRays: false,
  pupilZone: 0,
  cornealAsphericity: 0,
  lensAsphericity: 0,
  sceneView: 'side',
}

export type EyeCondition = 'normal' | 'myopia' | 'hyperopia' | 'presbyopia' | 'astigmatism'

/** Refractive error of the myopia and hyperopia presets, dioptres. */
export const CONDITION_ERROR = 3
/** Age of the presbyopia preset: the near point of a normal eye is then at 50 cm. */
export const PRESBYOPIA_AGE = 55

/** What a condition sets on the eye; the rest of the eye is left as it is. */
export function eyeCondition(condition: EyeCondition): Partial<EyeSetting> {
  const normal = { axialLength: NORMAL_AXIAL_LENGTH, cornealRadius: EYE.cornealRadius, cornealRadiusCross: null, cornealMeridian: 0 }
  switch (condition) {
    case 'normal':
      return normal
    case 'myopia':
      return { ...normal, axialLength: axialLengthFor(-CONDITION_ERROR) }
    case 'hyperopia':
      return { ...normal, axialLength: axialLengthFor(CONDITION_ERROR) }
    case 'presbyopia':
      return { ...normal, age: PRESBYOPIA_AGE }
    case 'astigmatism':
      // With the rule: the vertical meridian of the cornea is the steeper one.
      return { ...normal, cornealRadiusCross: cornealRadiusFor(cornealPower(EYE.cornealRadius) + CONDITION_ASTIGMATISM) }
  }
}

export function eyePreset(id: ExperimentId): EyeSetting | null {
  switch (id) {
    case 'eye-accommodation':
      // A normal eye of 20: near point at 8 cm. The object starts well within reach.
      return DEFAULT_EYE
    case 'eye-glasses':
      // An eye 1.14 mm too long (K = −3 D) looking at a distant chart, without glasses.
      return { ...DEFAULT_EYE, ...eyeCondition('myopia'), age: 25, objectDistance: null }
    case 'eye-ageing':
      // Reading at 40 cm: in reach at 20, out of reach from about 54.
      return { ...DEFAULT_EYE, objectDistance: cm(40), chart: 'text', letterHeight: mm(2), fieldOfView: mm(2) }
    case 'eye-astigmatism':
      // A cornea 2 D steeper vertically than horizontally looks at a distant fan chart: 0.00 / −2.00 × 180.
      return { ...DEFAULT_EYE, ...eyeCondition('astigmatism'), age: 25, objectDistance: null, chart: 'fan', letterAngle: 20 * ARC_MINUTE, fieldOfView: mm(2), sceneView: 'both' }
    case 'eye-chromatic':
      // A normal eye, held relaxed so that it cannot hide a positive lens, in white light with its dispersion.
      return { ...DEFAULT_EYE, age: 25, objectDistance: null, letterAngle: 20 * ARC_MINUTE, fieldOfView: mm(2), heldAccommodation: 0, pupilDiameter: mm(6), dispersion: true }
    case 'eye-spherical':
      // The schematic eye with spherical surfaces, relaxed, traced with real rays.
      return { ...DEFAULT_EYE, age: 25, objectDistance: null, letterAngle: 20 * ARC_MINUTE, fieldOfView: mm(2), heldAccommodation: 0, pupilDiameter: mm(6), realRays: true }
    default:
      return null
  }
}

/** The eye as the physics layer takes it, optionally at another age. */
export function toEyeSetup(eye: EyeSetting, age: number = eye.age): EyeSetup {
  return {
    axialLength: eye.axialLength,
    cornealRadius: eye.cornealRadius,
    age,
    pupilDiameter: eye.pupilDiameter,
    objectDistance: eye.objectDistance ?? Infinity,
    letterHeight: eye.letterHeight,
    letterAngle: eye.letterAngle,
    heldAccommodation: eye.heldAccommodation,
    glasses: eye.glassesOn ? { power: eye.glassesPower, vertexDistance: eye.vertexDistance, cylinder: eye.glassesCylinder, axis: eye.glassesAxis } : null,
    cornealRadiusCross: eye.cornealRadiusCross,
    cornealMeridian: eye.cornealMeridian,
    light: eye.wavelength,
    dispersion: eye.dispersion,
    realRays: eye.realRays,
    pupilZone: eye.pupilZone,
    cornealAsphericity: eye.cornealAsphericity,
    lensAsphericity: eye.lensAsphericity,
  }
}

export const DEFAULT_EXPERIMENT: ExperimentId = 'convex-lens'
