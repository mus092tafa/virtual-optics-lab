/**
 * Geometrical optics of a schematic human eye (Gullstrand–Emsley): one corneal
 * surface, the aqueous, a lens with two surfaces and the vitreous up to the
 * retina. Everything is paraxial and traced with ray-transfer matrices; a ray
 * is (y, u) with u the true slope in the medium it is in.
 *
 * Distances along the axis are measured from the corneal vertex, positive
 * into the eye. Vergences are in dioptres at the cornea, negative for light
 * diverging from a real object. See docs/PHYSICS.md, "The eye".
 */
import { UNIT, add2, apply2, composeBlocks, det2, gap, inverse2, meridianMatrix, mul2, powerMatrix, principalAxes, scale2, spheroCylinder, thinAstigmaticLens, toricSurface, NO_ELEMENT } from './astigmatism'
import type { Mat2, RayBlocks, SpheroCylinder, Vec2 } from './astigmatism'
import {
  AVERAGE_CORNEAL_ASPHERICITY,
  AVERAGE_SPHERICAL_ABERRATION,
  CHROMATIC_LINES,
  DEFAULT_VERTEX_DISTANCE,
  EYE,
  EYE_REFERENCE_WAVELENGTH,
  EYE_WHITE_BANDS,
  EYE_WHITE_TEMPERATURE,
  HOFSTETTER_AVERAGE,
  LETTER_STROKES,
  PUPIL_ZONES,
  SHARPNESS_LIMITS,
} from './constants'
import { axisCrossing, bisect, rayAt, rayFrom, refract } from './eyeRays'
import type { ConicSurface, MeridionalRay } from './eyeRays'
import { REFERENCE_MEDIA, mediaAt } from './ocularDispersion'
import type { Media } from './ocularDispersion'
import { compose, surfaceMatrix, translation } from './rayTransfer'
import type { RayMatrix } from './rayTransfer'
import { correctingLens, correctingPower, isSpherical, objectVergence, prescriptionOf, vergenceAtGlassesFor, vergenceMatrixAtCornea } from './spectacles'
import type { Glasses } from './spectacles'
import { blackbodySpectrum, wavelengthToRgb } from './spectrum'
import type { Rgb } from './spectrum'

export interface EyeAnatomy {
  /** Corneal vertex to retina. */
  axialLength: number
  /** Radius of the cornea in its first principal meridian. */
  cornealRadius: number
  /** Radius in the meridian at right angles to the first; the same radius when absent. */
  cornealRadiusCross?: number | null
  /** Direction of the first meridian, radians counter-clockwise from the horizontal as seen facing the eye. */
  cornealMeridian?: number
}

/** The lens at one state of accommodation. */
export interface LensShape {
  /** Corneal vertex to the front of the lens, where the iris lies. */
  chamberDepth: number
  frontRadius: number
  /** Negative: the back surface is concave towards the retina. */
  backRadius: number
  thickness: number
}

/** Largest lens state the model follows; 14 D at the youngest age offered needs about 1.6. */
export const MAX_LENS_STATE = 2.5

/**
 * The lens at state a: 0 is the relaxed and 1 the accommodated schematic eye.
 * The curvatures (1/r), the thickness and the chamber depth change linearly
 * with a; values above 1 continue the same change for young eyes.
 */
export function lensShape(state: number): LensShape {
  const { relaxed, accommodated } = EYE
  const mix = (from: number, to: number) => from + (to - from) * state
  return {
    chamberDepth: mix(relaxed.chamberDepth, accommodated.chamberDepth),
    frontRadius: 1 / mix(1 / relaxed.frontRadius, 1 / accommodated.frontRadius),
    backRadius: 1 / mix(1 / relaxed.backRadius, 1 / accommodated.backRadius),
    thickness: mix(relaxed.thickness, accommodated.thickness),
  }
}

/** Depth of a spherical surface of radius r at the height y above its vertex: |r| − √(r² − y²). */
export function surfaceSag(radius: number, height: number): number {
  const r = Math.abs(radius)
  return r - Math.sqrt(Math.max(0, r * r - height * height))
}

/**
 * Depth of a conicoid of vertex radius r and asphericity Q at the height y: c y²/(1 + √(1 − (1 + Q) c² y²)), c = 1/|r|.
 * Beyond the rim of a closed surface, the depth of the rim.
 */
export function conicSag(radius: number, asphericity: number, height: number): number {
  const c = 1 / Math.abs(radius)
  return (c * height * height) / (1 + Math.sqrt(Math.max(0, 1 - (1 + asphericity) * c * c * height * height)))
}

/** Height of the edge of the lens, where its two surfaces meet. */
export function lensEdgeHeight(shape: LensShape, asphericity = 0): number {
  let low = 0
  // A closed conicoid ends at its equator, 1/(c √(1 + Q)) from the axis.
  const equator = (radius: number) => (asphericity > -1 ? Math.abs(radius) / Math.sqrt(1 + asphericity) : Infinity)
  let high = Math.min(equator(shape.frontRadius), equator(shape.backRadius), 3 * Math.abs(shape.frontRadius))
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2
    if (conicSag(shape.frontRadius, asphericity, middle) + conicSag(shape.backRadius, asphericity, middle) < shape.thickness) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** Radius of the cornea in its second principal meridian. */
export function crossRadius(eye: EyeAnatomy): number {
  return eye.cornealRadiusCross ?? eye.cornealRadius
}

/** True when the two meridians of the cornea differ. */
export function isAstigmatic(eye: EyeAnatomy): boolean {
  return Math.abs(crossRadius(eye) - eye.cornealRadius) > 1e-9
}

/** A section of the eye through its axis: the vertical one seen from the side, the horizontal one seen from above. */
export type EyeSection = 'side' | 'top'

/** Radius of the cornea in a section: the curvature there is c₁ cos²δ + c₂ sin²δ, δ from the first meridian. */
export function sectionRadius(eye: EyeAnatomy, section: EyeSection): number {
  const angle = (section === 'side' ? Math.PI / 2 : 0) - (eye.cornealMeridian ?? 0)
  return 1 / (Math.cos(angle) ** 2 / eye.cornealRadius + Math.sin(angle) ** 2 / crossRadius(eye))
}

/** How far a patch of light reaches from the axis along a section. */
export function extentAlong(shape: SpreadShape, section: EyeSection): number {
  if (shape.kind === 'rings') return Math.max(0, ...shape.radii)
  const angle = (section === 'side' ? Math.PI / 2 : 0) - shape.angle
  return Math.hypot(shape.major * Math.cos(angle), shape.minor * Math.sin(angle))
}

/** Power of the corneal surface, (n′ − n)/r. */
export function cornealPower(cornealRadius: number, media: Media = REFERENCE_MEDIA): number {
  return (media.humour - 1) / cornealRadius
}

/** The corneal radius that has a given power. */
export function cornealRadiusFor(power: number): number {
  return (EYE.humourIndex - 1) / power
}

/** Equivalent power of the lens in the eye: P₁ + P₂ − (t/n) P₁ P₂. */
export function lensPower(shape: LensShape, media: Media = REFERENCE_MEDIA): number {
  const front = (media.lens - media.humour) / shape.frontRadius
  const back = (media.humour - media.lens) / shape.backRadius
  return front + back - (shape.thickness / media.lens) * front * back
}

/** The eye's refracting elements as matrices, starting just in front of the cornea. */
interface EyeOptics {
  /** Cornea to the plane of the iris (the front of the lens). */
  toStop: RayMatrix
  /** Cornea to just behind the lens, in the vitreous. */
  toLensBack: RayMatrix
  /** Corneal vertex to the back of the lens. */
  lensBack: number
}

function eyeOptics(cornealRadius: number, shape: LensShape, media: Media): EyeOptics {
  const toStop = compose(translation(shape.chamberDepth), surfaceMatrix(1, media.humour, cornealRadius))
  const front = surfaceMatrix(media.humour, media.lens, shape.frontRadius)
  const back = surfaceMatrix(media.lens, media.humour, shape.backRadius)
  const toLensBack = compose(back, compose(translation(shape.thickness), compose(front, toStop)))
  return { toStop, toLensBack, lensBack: shape.chamberDepth + shape.thickness }
}

/** Equivalent power of the whole eye in the meridian of the given corneal radius, −n′ C of its matrix. */
export function totalPower(cornealRadius: number, state: number, media: Media = REFERENCE_MEDIA): number {
  return -media.humour * eyeOptics(cornealRadius, lensShape(state), media).toLensBack[2]
}

/**
 * Where light of a given vergence at the cornea comes to a focus, measured
 * from the corneal vertex; null when it leaves the lens without converging.
 */
export function focusDistance(cornealRadius: number, state: number, vergence: number, media: Media = REFERENCE_MEDIA): number | null {
  const optics = eyeOptics(cornealRadius, lensShape(state), media)
  const [a, b, c, d] = optics.toLensBack
  // The ray of unit height from the axial object point has the slope −L.
  const height = a - b * vergence
  const slope = c - d * vergence
  return slope < 0 ? optics.lensBack - height / slope : null
}

/** The vergence at the cornea that one meridian of the eye, at lens state a, focuses on the retina. */
function meridianVergence(axialLength: number, cornealRadius: number, state: number, media: Media): number {
  const optics = eyeOptics(cornealRadius, lensShape(state), media)
  const [a, b, c, d] = optics.toLensBack
  const x = axialLength - optics.lensBack
  return (a + x * c) / (b + x * d)
}

/** The vergence at the cornea that the eye, at lens state a, focuses on its retina (in its first meridian). */
export function focusedVergence(eye: EyeAnatomy, state: number, media: Media = REFERENCE_MEDIA): number {
  return meridianVergence(eye.axialLength, eye.cornealRadius, state, media)
}

/** Refractive errors of the relaxed eye in its two principal meridians. */
export function principalErrors(eye: EyeAnatomy, media: Media = REFERENCE_MEDIA): [first: number, cross: number] {
  return [meridianVergence(eye.axialLength, eye.cornealRadius, 0, media), meridianVergence(eye.axialLength, crossRadius(eye), 0, media)]
}

/**
 * Refractive error K: the vergence of the relaxed eye's far point at the cornea (negative in myopia). For an
 * astigmatic eye, the mean of its two meridians (the spherical equivalent).
 */
export function refractiveError(eye: EyeAnatomy, media: Media = REFERENCE_MEDIA): number {
  const [first, cross] = principalErrors(eye, media)
  return (first + cross) / 2
}

/** The refractive error as a matrix: K₁ in the first meridian of the cornea, K₂ across it. */
export function refractionMatrix(eye: EyeAnatomy, media: Media = REFERENCE_MEDIA): Mat2 {
  const [first, cross] = principalErrors(eye, media)
  return meridianMatrix(first, cross, eye.cornealMeridian ?? 0)
}

/** Accommodation of the lens state a, in dioptres at the cornea, relative to the relaxed eye; the same in every meridian. */
export function accommodationOf(eye: EyeAnatomy, state: number, media: Media = REFERENCE_MEDIA): number {
  return focusedVergence(eye, 0, media) - focusedVergence(eye, state, media)
}

/** The lens state that gives a wanted accommodation (which grows steadily with the state). */
export function stateForAccommodation(eye: EyeAnatomy, accommodation: number, media: Media = REFERENCE_MEDIA): number {
  if (accommodation <= 0) return 0
  let low = 0
  let high = MAX_LENS_STATE
  if (accommodationOf(eye, high, media) <= accommodation) return high
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2
    if (accommodationOf(eye, middle, media) < accommodation) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** Largest accommodation at an age, from Hofstetter's population average; never negative. */
export function maxAccommodation(age: number): number {
  return Math.max(0, HOFSTETTER_AVERAGE.atBirth - HOFSTETTER_AVERAGE.perYear * age)
}

/** The axial length at which a relaxed eye with this cornea has the refractive error K. */
export function axialLengthFor(error: number, cornealRadius: number = EYE.cornealRadius): number {
  return focusDistance(cornealRadius, 0, error) ?? NaN
}

/** Length of the schematic eye that focuses distant objects on its retina when relaxed. */
export const NORMAL_AXIAL_LENGTH = axialLengthFor(0)

export type Sharpness = 'sharp' | 'slightly blurred' | 'blurred' | 'unreadable'

/** Grades the blur against the stroke width of the chart's letters on the retina: a geometric measure, not visual acuity. */
export function sharpnessOf(blurDiameter: number, strokeWidth: number): Sharpness {
  const ratio = strokeWidth > 0 ? blurDiameter / strokeWidth : Infinity
  if (ratio <= SHARPNESS_LIMITS[0]) return 'sharp'
  if (ratio <= SHARPNESS_LIMITS[1]) return 'slightly blurred'
  if (ratio <= SHARPNESS_LIMITS[2]) return 'blurred'
  return 'unreadable'
}

export interface EyeSetup extends EyeAnatomy {
  /** Years; sets only how far the lens can accommodate. */
  age: number
  /** Diameter of the opening of the iris. */
  pupilDiameter: number
  /** Object to cornea; Infinity for a distant object. */
  objectDistance: number
  /** Height of one letter of the chart, for an object at a finite distance. */
  letterHeight: number
  /** Angle one letter subtends, for a distant object. */
  letterAngle: number
  /** Accommodation the lens is held at, in dioptres; null lets the eye accommodate by itself. */
  heldAccommodation: number | null
  glasses: Glasses | null
  /** Wavelength of the light on the chart; white light when null or absent. */
  light?: number | null
  /** Let the indices of the eye follow the wavelength. Without it the eye has its 589 nm indices in every light. */
  dispersion?: boolean
  /** Trace real rays through the surfaces instead of paraxial ones. */
  realRays?: boolean
  /**
   * A ring stop in the pupil: the inner radius of the open ring as a fraction of the pupil's radius, 0 for an open
   * pupil. It selects one zone of the pupil for real rays and is ignored for paraxial ones.
   */
  pupilZone?: number
  /** Asphericity Q of the cornea and of both lens surfaces; spheres when absent. They matter to real rays only. */
  cornealAsphericity?: number
  lensAsphericity?: number
}

export interface RayPoint {
  x: number
  y: number
}

/** The patch that the light of one object point covers at a plane, centred on the axis. */
export type SpreadShape =
  /** A uniformly lit ellipse: its semi-axes and the direction of the larger, as seen facing the eye. */
  | { kind: 'ellipse'; major: number; minor: number; angle: number }
  /** Rings of equal energy: the radii that bound them, starting at the axis ray. */
  | { kind: 'rings'; radii: number[] }

/** One part of the light of an object point on the retina: a band of the spectrum. */
export interface SpreadComponent {
  /** Linear-sRGB weight of the band; over all components the weights add up to the colour of the light. */
  rgb: Rgb
  /** Share of the luminance. */
  luminance: number
  /** Fraction of the band's light that passes the eye. */
  energy: number
  shape: SpreadShape
}

/** Cross-section of the beam of the axial object point at a plane behind the lens. */
export interface BeamSection {
  /** From the corneal vertex. */
  distance: number
  /** Plane minus the retina: positive behind the retina. */
  offset: number
  atRetina: boolean
  shape: SpreadShape
}

/** A line in which an astigmatic beam comes to a focus. */
export interface FocalLine {
  /** From the corneal vertex. */
  distance: number
  /** Position minus the retina's: positive behind the retina. */
  offset: number
  /** Direction of the line as seen facing the eye. */
  angle: number
  length: number
}

/** The eye looking at the object, with or without the glasses. */
export interface EyeView {
  glasses: Glasses | null
  /** Vergence of the object's light arriving at the cornea; the mean of the two meridians behind a cylinder. */
  vergence: number
  /** Accommodation that would put the image on the retina (negative: the eye would have to relax beyond its relaxed state). */
  accommodationNeeded: number
  /** Accommodation of the lens as it is. */
  accommodation: number
  lensState: number
  lens: LensShape
  lensPower: number
  /** Equivalent power in the first meridian of the cornea. */
  totalPower: number
  /** Focus of the object's light from the corneal vertex, midway between the focal lines; null when it does not converge in the eye. */
  focusDistance: number | null
  /** Focus position minus the retina's: positive behind the retina. */
  focusOffset: number | null
  /** The two focal lines, nearer first (one point twice for a symmetric eye); null when the light does not converge. */
  focalLines: [FocalLine, FocalLine] | null
  /** The paraxial patch of an object point on the retina: its two diameters and the direction of the larger. */
  blur: { major: number; minor: number; angle: number }
  /** Equivalent blur diameter: 2√2 × the RMS radius of the light of an object point on the retina. The diameter of a disc. */
  blurDiameter: number
  /** The light of one object point on the retina. */
  pointSpread: SpreadComponent[]
  /** Height of one letter on the retina; negative because the retinal image is inverted. */
  letterImageHeight: number
  /** Chart, in letter heights, to the retina as it is seen (upright), in metres; as seen facing the eye. */
  letterScale: Mat2
  strokeWidth: number
  sharpness: Sharpness
  /** Retinal illuminance relative to the widest pupil offered. */
  illuminance: number
  /** Nearest and farthest object distances (from the cornea) this eye can focus in this view; Infinity for a distant limit, null when there is none in front of the eye. */
  farPoint: number | null
  nearPoint: number | null
  /**
   * Rays from the axial object point in the vertical section: through the top, the centre and the bottom of the pupil
   * (more of them when real rays are traced), up to the retina or the focus, whichever is farther. Each has a point in
   * front of the first element, one at every element and one at its end.
   */
  rays: RayPoint[][]
  /** The same for the horizontal section: through the left edge, the centre and the right edge of the pupil. */
  raysTop: RayPoint[][]
  /** True when the rays of the two sections leave their planes, so that what is drawn is their projection. */
  skew: boolean
  /** Cross-sections of the beam from in front of the first focus to behind the last. */
  sections: BeamSection[]
  /** With real rays: the marginal ray's axis crossing relative to the retina and the longitudinal aberration in dioptres. */
  /**
   * With real rays, for the ray through the edge of the open pupil or through the middle of the ring: its height in
   * the pupil, where it crosses the axis relative to the retina, and K(0) − K(h) in dioptres. Null with paraxial rays,
   * and when that ray does not pass the eye.
   */
  sphericalAberration: { rayHeight: number; marginalOffset: number | null; longitudinal: number; zoneRefraction: number } | null
}

export interface EyeSolution {
  /** The eye, its object and its glasses as they were solved. */
  setup: EyeSetup
  /** In the first meridian of the cornea, and in the one across it. */
  cornealPower: number
  cornealPowerCross: number
  /** Power of the relaxed lens. */
  relaxedLensPower: number
  /** The mean of the two meridians. */
  refractiveError: number
  /** The refractive error as sphere, negative cylinder and axis. */
  refraction: SpheroCylinder
  astigmatic: boolean
  maxAccommodation: number
  /** Spectacle power that corrects K, at the vertex distance of the glasses (the usual 12 mm when none are worn). */
  correctingPower: number
  /** The same with its cylinder. */
  correctingLens: SpheroCylinder
  /** Wavelength the measurements refer to. */
  wavelength: number
  /** K(red line) − K(blue line) of the relaxed eye; null while the indices do not follow the wavelength. */
  chromaticDifference: number | null
  /** True when the light was traced with real rays. */
  realRays: boolean
  /** What the model could not do as asked. */
  notices: string[]
  view: EyeView
  /** The same eye and object without the glasses; null when none are worn. */
  bare: EyeView | null
}

/** A band of the light on the chart. */
interface Band {
  media: Media
  rgb: Rgb
  luminance: number
}

/** The light of the chart as bands, and the indices the measurements refer to. */
function lightOf(setup: EyeSetup): { wavelength: number; media: Media; bands: Band[] } {
  const dispersion = setup.dispersion ?? false
  const wavelength = setup.light ?? EYE_REFERENCE_WAVELENGTH
  const media = dispersion ? mediaAt(wavelength) : REFERENCE_MEDIA
  if (setup.light != null) return { wavelength, media, bands: [{ media, rgb: wavelengthToRgb(wavelength), luminance: 1 }] }
  if (!dispersion) return { wavelength, media, bands: [{ media, rgb: [1, 1, 1], luminance: 1 }] }
  return { wavelength, media, bands: whiteBands() }
}

let white: Band[] | null = null
/** White light as bands of a black body, each channel scaled so that the bands add up to the display's white. */
function whiteBands(): Band[] {
  if (white) return white
  const samples = blackbodySpectrum(EYE_WHITE_TEMPERATURE, EYE_WHITE_BANDS)
  const total = [0, 1, 2].map((channel) => samples.reduce((sum, sample) => sum + sample.rgb[channel], 0))
  white = samples.map((sample) => {
    const rgb: Rgb = [sample.rgb[0] / total[0], sample.rgb[1] / total[1], sample.rgb[2] / total[2]]
    return { media: mediaAt(sample.wavelength), rgb, luminance: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] }
  })
  return white
}

/** Mean of r² over a patch. */
function meanSquareRadius(shape: SpreadShape): number {
  if (shape.kind === 'ellipse') return (shape.major * shape.major + shape.minor * shape.minor) / 4
  // Within a zone ρ² runs between the squares of its bounding radii.
  let sum = 0
  for (let i = 1; i < shape.radii.length; i++) sum += (shape.radii[i - 1] ** 2 + shape.radii[i] ** 2) / 2
  return shape.radii.length > 1 ? sum / (shape.radii.length - 1) : 0
}

/** 2√2 × the luminance-weighted RMS radius of the light of an object point: the diameter of a uniform disc. */
export function equivalentBlurDiameter(pointSpread: readonly SpreadComponent[]): number {
  let weight = 0
  let sum = 0
  for (const component of pointSpread) {
    const share = component.luminance * component.energy
    weight += share
    sum += share * meanSquareRadius(component.shape)
  }
  return weight > 0 ? 2 * Math.SQRT2 * Math.sqrt(sum / weight) : 0
}

/** The eye's elements as block matrices, starting just in front of the cornea. */
function eyeBlocks(setup: EyeAnatomy, lens: LensShape, media: Media): { toStop: RayBlocks; toLensBack: RayBlocks; lensBack: number } {
  const cornea = toricSurface(1, media.humour, meridianMatrix(1 / setup.cornealRadius, 1 / crossRadius(setup), setup.cornealMeridian ?? 0))
  const toStop = composeBlocks(gap(lens.chamberDepth), cornea)
  const front = toricSurface(media.humour, media.lens, scale2(UNIT, 1 / lens.frontRadius))
  const back = toricSurface(media.lens, media.humour, scale2(UNIT, 1 / lens.backRadius))
  const toLensBack = composeBlocks(back, composeBlocks(gap(lens.thickness), composeBlocks(front, toStop)))
  return { toStop, toLensBack, lensBack: lens.chamberDepth + lens.thickness }
}

/** Matrix from the first element (the glasses, or the cornea) to the cornea. */
function approach(glasses: Glasses | null): RayBlocks {
  return glasses ? composeBlocks(gap(glasses.vertexDistance), thinAstigmaticLens(powerMatrix(prescriptionOf(glasses)))) : NO_ELEMENT
}

/**
 * The paraxial beam of the axial object point. Its rays are named by the point s where they pass the pupil: behind
 * the lens the ray is at the height P s with the slope Q s.
 */
interface Beam {
  lensBack: number
  position: Mat2
  slope: Mat2
  /** Pupil point to the height at the first element. */
  entrance: Mat2
  /** Direction of an object point to its place on the retina, by the ray through the centre of the pupil. */
  imageScale: Mat2
}

function paraxialBeam(setup: EyeSetup, glasses: Glasses | null, lens: LensShape, media: Media, firstVergence: number): Beam {
  const eye = eyeBlocks(setup, lens, media)
  const entry = approach(glasses)
  const toStop = composeBlocks(eye.toStop, entry)
  const toLensBack = composeBlocks(eye.toLensBack, entry)
  const toRetina = composeBlocks(gap(setup.axialLength - eye.lensBack), toLensBack)
  // A ray meeting the first element at the height p from the axial object point has the slope −L p.
  const height = (blocks: RayBlocks) => add2(blocks.a, scale2(blocks.b, -firstVergence))
  const entrance = inverse2(height(toStop))
  // A ray from the direction α has the slope −L p − α; the chief ray is the one with no height at the pupil.
  const chief = mul2(entrance, toStop.b)
  return {
    lensBack: eye.lensBack,
    position: mul2(height(toLensBack), entrance),
    slope: mul2(add2(toLensBack.c, scale2(toLensBack.d, -firstVergence)), entrance),
    entrance,
    imageScale: add2(mul2(height(toRetina), chief), scale2(toRetina.b, -1)),
  }
}

/** Pupil point to the height at the plane x behind the lens. */
function spreadAt(beam: Beam, x: number): Mat2 {
  return add2(beam.position, scale2(beam.slope, x - beam.lensBack))
}

/** The patch the pupil of a given radius lights at the plane x. */
function ellipseAt(beam: Beam, x: number, pupilRadius: number): SpreadShape & { kind: 'ellipse' } {
  const axes = principalAxes(spreadAt(beam, x))
  return { kind: 'ellipse', major: axes.major * pupilRadius, minor: axes.minor * pupilRadius, angle: axes.angle }
}

/** The planes behind the lens at which the beam collapses to a line: the roots of det(P + t Q) = 0. */
function focalPlanes(beam: Beam): [number, number] | null {
  const p = beam.position
  const q = beam.slope
  const a = det2(q)
  const b = p[0] * q[3] + q[0] * p[3] - p[1] * q[2] - q[1] * p[2]
  const c = det2(p)
  if (Math.abs(a) < 1e-12) return null
  // A symmetric beam has a double root; rounding must not make it complex.
  const root = Math.sqrt(Math.max(0, b * b - 4 * a * c))
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((first, second) => first - second)
  if (roots[0] <= 0) return null
  return [beam.lensBack + roots[0], beam.lensBack + roots[1]]
}

/** Length of the incoming ray given before the first element. */
const RAY_LEAD = 0.01

/** The paraxial ray through the pupil point s, followed to the plane x = end; its vertical and its horizontal projection. */
function tracePath(setup: EyeSetup, glasses: Glasses | null, lens: LensShape, media: Media, firstVergence: number, start: Vec2, end: number): { side: RayPoint[]; top: RayPoint[] } {
  const side: RayPoint[] = []
  const top: RayPoint[] = []
  let x = glasses ? -glasses.vertexDistance : 0
  let y: Vec2 = start
  let u: Vec2 = [-firstVergence * start[0], -firstVergence * start[1]]
  const mark = (at: number, height: Vec2) => {
    top.push({ x: at, y: height[0] })
    side.push({ x: at, y: height[1] })
  }
  const advance = (to: number) => {
    y = [y[0] + (to - x) * u[0], y[1] + (to - x) * u[1]]
    x = to
    mark(x, y)
  }
  const refractAt = (n: number, nPrime: number, curvature: Mat2) => {
    const bend = apply2(curvature, y)
    const k = (nPrime - n) / nPrime
    u = [(n / nPrime) * u[0] - k * bend[0], (n / nPrime) * u[1] - k * bend[1]]
  }
  // Where the ray comes from, a short way in front of the first element.
  mark(x - RAY_LEAD, [y[0] - u[0] * RAY_LEAD, y[1] - u[1] * RAY_LEAD])
  mark(x, y)
  if (glasses) {
    const bend = apply2(powerMatrix(prescriptionOf(glasses)), y)
    u = [u[0] - bend[0], u[1] - bend[1]]
    advance(0)
  }
  refractAt(1, media.humour, meridianMatrix(1 / setup.cornealRadius, 1 / crossRadius(setup), setup.cornealMeridian ?? 0))
  advance(lens.chamberDepth)
  refractAt(media.humour, media.lens, scale2(UNIT, 1 / lens.frontRadius))
  advance(lens.chamberDepth + lens.thickness)
  refractAt(media.lens, media.humour, scale2(UNIT, 1 / lens.backRadius))
  advance(end)
  return { side, top }
}

// --- Real rays ---------------------------------------------------------------

/** The surfaces of the eye as conicoids. */
function eyeSurfaces(setup: EyeSetup, lens: LensShape, media: Media): ConicSurface[] {
  const lensShapeQ = setup.lensAsphericity ?? 0
  return [
    { vertex: 0, curvature: 1 / setup.cornealRadius, asphericity: setup.cornealAsphericity ?? 0, indexBefore: 1, indexAfter: media.humour },
    { vertex: lens.chamberDepth, curvature: 1 / lens.frontRadius, asphericity: lensShapeQ, indexBefore: media.humour, indexAfter: media.lens },
    { vertex: lens.chamberDepth + lens.thickness, curvature: 1 / lens.backRadius, asphericity: lensShapeQ, indexBefore: media.lens, indexAfter: media.humour },
  ]
}

/** A real ray of the axial object point, followed through the eye. */
interface RealRay {
  /** Its points in front of and at each element, without the last one behind the lens. */
  points: RayPoint[]
  /** Height at the plane of the iris. */
  stopHeight: number
  /** The ray in the vitreous. */
  final: MeridionalRay
}

/** The real ray that meets the first element at the height y₀. The glasses are an ideal thin lens: u′ = u − F y. */
function launch(surfaces: readonly ConicSurface[], glasses: Glasses | null, firstVergence: number, y0: number): RealRay | null {
  const start = glasses ? -glasses.vertexDistance : 0
  let slope = -firstVergence * y0
  // As for a paraxial ray: a point in front of the first element, then one at each element.
  const points: RayPoint[] = [{ x: start - RAY_LEAD, y: y0 - slope * RAY_LEAD }]
  if (glasses) {
    points.push({ x: start, y: y0 })
    slope -= glasses.power * y0
  }
  let ray = rayFrom(start, y0, slope)
  let stopHeight = 0
  for (let i = 0; i < surfaces.length; i++) {
    const next = refract(ray, surfaces[i])
    // A ray beyond the edge of the lens would meet its back surface in front of its front surface.
    if (!next || next.dz <= 0 || next.z < ray.z - 1e-12) return null
    points.push({ x: next.z, y: next.y })
    ray = next
    // The iris lies at the vertex plane of the lens front; the ray passes it on its way from the cornea.
    if (i === 0) stopHeight = rayAt(ray, surfaces[1].vertex).y
  }
  return { points, stopHeight, final: ray }
}

/** The real ray that passes the pupil at the height h; null when no ray gets there or through the lens. */
function rayThroughPupil(surfaces: readonly ConicSurface[], glasses: Glasses | null, firstVergence: number, height: number): RealRay | null {
  if (height === 0) return launch(surfaces, glasses, firstVergence, 0)
  // A lost ray counts as one that entered too high.
  const miss = (y0: number) => (launch(surfaces, glasses, firstVergence, y0)?.stopHeight ?? Infinity) - height
  let high = height
  for (let i = 0; i < 12 && miss(high) < 0; i++) high *= 1.5
  if (miss(high) < 0) return null
  const ray = launch(surfaces, glasses, firstVergence, bisect(miss, 0, high))
  return ray && Math.abs(ray.stopHeight - height) < 1e-8 ? ray : null
}

/** Vergence at the cornea of the object point whose ray through the pupil height h meets the axis at the retina. */
function zoneRefraction(surfaces: readonly ConicSurface[], axialLength: number, height: number, around: number): number {
  // More divergent light is focused farther back: the ray is still above the axis at the retina.
  const above = (vergence: number) => {
    const ray = rayThroughPupil(surfaces, null, vergence, height)
    return ray ? rayAt(ray.final, axialLength).y : -1
  }
  return bisect(above, around - 15, around + 15)
}

let averageLens: number | null = null
/**
 * Asphericity of both lens surfaces that, with the average cornea, leaves the average eye's spherical aberration:
 * solved, not stored. The homogeneous lens of the schematic eye needs it in place of the real lens's gradient index.
 */
export function averageLensAsphericity(): number {
  if (averageLens !== null) return averageLens
  const eye: EyeSetup = {
    axialLength: NORMAL_AXIAL_LENGTH,
    cornealRadius: EYE.cornealRadius,
    age: 20,
    pupilDiameter: 2 * AVERAGE_SPHERICAL_ABERRATION.rayHeight,
    objectDistance: Infinity,
    letterHeight: 0,
    letterAngle: 0,
    heldAccommodation: 0,
    glasses: null,
    cornealAsphericity: AVERAGE_CORNEAL_ASPHERICITY,
  }
  const excess = (lensAsphericity: number) => {
    const surfaces = eyeSurfaces({ ...eye, lensAsphericity }, lensShape(0), REFERENCE_MEDIA)
    const incoming = launch(surfaces, null, 0, AVERAGE_SPHERICAL_ABERRATION.rayHeight)
    if (!incoming) return 1
    return -zoneRefraction(surfaces, eye.axialLength, incoming.stopHeight, 0) - AVERAGE_SPHERICAL_ABERRATION.longitudinal
  }
  averageLens = bisect(excess, -8, 0)
  return averageLens
}

/** The open part of the pupil: the inner radius of a ring stop, as a fraction of the pupil's radius. */
const ringOf = (setup: EyeSetup): number => Math.min(0.99, Math.max(0, setup.pupilZone ?? 0))

/** Height in the pupil that stands for the open zone: its edge when the pupil is open, the RMS radius of a ring. */
export function zoneHeight(pupilDiameter: number, pupilZone = 0): number {
  return pupilZone > 0 ? (pupilDiameter / 2) * Math.sqrt((1 + pupilZone * pupilZone) / 2) : pupilDiameter / 2
}

/**
 * Longitudinal spherical aberration of the eye for the ray at a height in the pupil, K(0) − K(h) in dioptres at the
 * cornea, at a lens state: positive when that ray is focused in front of the paraxial rays. Null when the ray does
 * not pass the eye.
 */
export function longitudinalAberration(setup: EyeSetup, height: number, lensState = 0, media: Media = REFERENCE_MEDIA): number | null {
  const surfaces = eyeSurfaces(setup, lensShape(lensState), media)
  const paraxial = focusedVergence(setup, lensState, media)
  if (!rayThroughPupil(surfaces, null, paraxial, height)) return null
  return paraxial - zoneRefraction(surfaces, setup.axialLength, height, paraxial)
}

/**
 * The real rays of one band: those that bound the zones of equal area of the open part of the pupil, and how much of
 * its light gets through.
 */
function zoneRays(surfaces: readonly ConicSurface[], glasses: Glasses | null, firstVergence: number, pupilRadius: number, ring: number): { rays: MeridionalRay[]; energy: number } {
  const rays: MeridionalRay[] = []
  for (let i = 0; i <= PUPIL_ZONES; i++) {
    const ray = rayThroughPupil(surfaces, glasses, firstVergence, pupilRadius * Math.sqrt(ring * ring + ((1 - ring * ring) * i) / PUPIL_ZONES))
    if (!ray) break
    rays.push(ray.final)
  }
  return { rays, energy: Math.max(0, rays.length - 1) / PUPIL_ZONES }
}

const ringsAt = (rays: readonly MeridionalRay[], x: number): SpreadShape => ({ kind: 'rings', radii: rays.map((ray) => Math.abs(rayAt(ray, x).y)) })

/** Heights in the pupil, as fractions of its radius, of the real rays that are drawn: through the open zone only. */
const fanOf = (ring: number): number[] => (ring > 0 ? [1, (1 + ring) / 2, ring, -ring, -(1 + ring) / 2, -1] : [1, 2 / 3, 1 / 3, 0, -1 / 3, -2 / 3, -1])

/** The planes at which the beam is shown in cross-section: around the foci and the retina. */
function sectionPlanes(lensBack: number, axialLength: number, foci: readonly number[]): number[] {
  const marks = [axialLength, ...foci.filter((focus) => focus > lensBack + 5e-4)]
  const low = Math.min(...marks)
  const high = Math.max(...marks)
  const margin = Math.max(2.5e-4, 0.35 * (high - low))
  const planes = [Math.max(lensBack + 5e-4, low - margin), ...marks, high + margin]
  // The plane midway between two focal lines holds the circle of least confusion.
  if (foci.length === 2 && foci[1] - foci[0] > 1e-6) planes.push((foci[0] + foci[1]) / 2)
  planes.sort((first, second) => first - second)
  return planes.filter((plane, index) => index === 0 || plane - planes[index - 1] > 1e-6)
}

/** Object distance from the cornea at which the cornea receives a wanted mean vergence; null when no real object does that. */
function objectDistanceFor(wantedAtCornea: number, glasses: Glasses | null): number | null {
  let atFirst: number
  if (!glasses) atFirst = wantedAtCornea
  else if (isSpherical(glasses)) atFirst = vergenceAtGlassesFor(wantedAtCornea, glasses)
  else {
    // Behind a cylinder the mean vergence at the cornea grows with the vergence at the lens; found by bisection.
    const mean = (vergence: number) => {
      const matrix = vergenceMatrixAtCornea(vergence, glasses)
      return (matrix[0] + matrix[3]) / 2 - wantedAtCornea
    }
    if (mean(-40) > 0 || mean(1e-9) < 0) return null
    atFirst = bisect(mean, -40, 1e-9)
  }
  if (atFirst > 1e-9) return null
  const offset = glasses?.vertexDistance ?? 0
  return Math.abs(atFirst) <= 1e-9 ? Infinity : -1 / atFirst + offset
}

interface Plan {
  /** Mean refractive error and largest accommodation of the eye, in the light the measurements refer to. */
  error: number
  amplitude: number
  media: Media
  bands: Band[]
  /** Real rays are traced. */
  real: boolean
}

function viewOf(setup: EyeSetup, glasses: Glasses | null, plan: Plan): EyeView {
  const { media } = plan
  const offset = glasses?.vertexDistance ?? 0
  // Vergence and angular size of the object at the first element it meets.
  const distance = setup.objectDistance - offset
  const firstVergence = objectVergence(distance)
  const letterAngle = Number.isFinite(distance) ? setup.letterHeight / distance : setup.letterAngle
  const atCornea = glasses ? vergenceMatrixAtCornea(firstVergence, glasses) : scale2(UNIT, firstVergence)
  const vergence = (atCornea[0] + atCornea[3]) / 2

  // The eye accommodates for the dioptric midpoint of its two meridians.
  const accommodationNeeded = plan.error - vergence
  const wanted = setup.heldAccommodation ?? accommodationNeeded
  const accommodation = Math.min(plan.amplitude, Math.max(0, wanted))
  const lensState = stateForAccommodation(setup, accommodation, media)
  const lens = lensShape(lensState)
  const pupilRadius = setup.pupilDiameter / 2
  // A ring stop selects a zone for real rays only.
  const ring = plan.real ? ringOf(setup) : 0
  const beam = paraxialBeam(setup, glasses, lens, media, firstVergence)

  const atRetina = ellipseAt(beam, setup.axialLength, pupilRadius)
  const blur = { major: 2 * atRetina.major, minor: 2 * atRetina.minor, angle: atRetina.angle }
  // The image is inverted on the retina; one letter covers the mean of the two meridians' scales.
  const letterImageHeight = -Math.sqrt(Math.abs(det2(beam.imageScale))) * letterAngle
  const strokeWidth = Math.abs(letterImageHeight) / LETTER_STROKES

  const planes = focalPlanes(beam)
  const focalLines = planes
    ? (planes.map((plane) => {
        const line = ellipseAt(beam, plane, pupilRadius)
        return { distance: plane, offset: plane - setup.axialLength, angle: line.angle, length: 2 * line.major }
      }) as [FocalLine, FocalLine])
    : null
  const focus = planes ? (planes[0] + planes[1]) / 2 : null
  let end = Math.max(setup.axialLength, planes?.[1] ?? 0)

  // The light of the object point on the retina, band by band, and the rays that are drawn.
  const surfaces = plan.real ? eyeSurfaces(setup, lens, media) : null
  const pointSpread: SpreadComponent[] = plan.bands.map((band) => {
    if (plan.real) {
      const zones = zoneRays(eyeSurfaces(setup, lens, band.media), glasses, firstVergence, pupilRadius, ring)
      return { rgb: band.rgb, luminance: band.luminance, energy: zones.energy, shape: ringsAt(zones.rays, setup.axialLength) }
    }
    const shape = band.media === media ? atRetina : ellipseAt(paraxialBeam(setup, glasses, lens, band.media, firstVergence), setup.axialLength, pupilRadius)
    return { rgb: band.rgb, luminance: band.luminance, energy: 1, shape }
  })

  let rays: RayPoint[][]
  let raysTop: RayPoint[][]
  let sections: BeamSection[]
  let sphericalAberration: EyeView['sphericalAberration'] = null
  const section = (plane: number, shape: SpreadShape): BeamSection => ({ distance: plane, offset: plane - setup.axialLength, atRetina: Math.abs(plane - setup.axialLength) < 1e-9, shape })
  if (surfaces) {
    const rayHeight = zoneHeight(setup.pupilDiameter, ring)
    const marginal = rayThroughPupil(surfaces, glasses, firstVergence, rayHeight)
    const crossing = marginal ? axisCrossing(marginal.final) : null
    if (crossing !== null && crossing > beam.lensBack) end = Math.max(end, crossing)
    if (marginal) {
      const paraxial = focusedVergence(setup, lensState, media)
      const zone = zoneRefraction(surfaces, setup.axialLength, rayHeight, paraxial)
      sphericalAberration = { rayHeight, marginalOffset: crossing === null ? null : crossing - setup.axialLength, longitudinal: paraxial - zone, zoneRefraction: zone }
    }
    rays = fanOf(ring).flatMap((fraction) => {
      const ray = rayThroughPupil(surfaces, glasses, firstVergence, Math.abs(fraction) * pupilRadius)
      if (!ray) return []
      const sign = fraction < 0 ? -1 : 1
      return [[...ray.points, { x: end, y: rayAt(ray.final, end).y }].map((point) => ({ x: point.x, y: sign * point.y }))]
    })
    raysTop = rays
    const zones = zoneRays(surfaces, glasses, firstVergence, pupilRadius, ring)
    const foci = [planes ? planes[0] : null, crossing].filter((plane): plane is number => plane !== null).sort((first, second) => first - second)
    sections = sectionPlanes(beam.lensBack, setup.axialLength, foci).map((plane) => section(plane, ringsAt(zones.rays, plane)))
  } else {
    const path = (pupilPoint: Vec2) => tracePath(setup, glasses, lens, media, firstVergence, apply2(beam.entrance, pupilPoint), end)
    rays = [pupilRadius, 0, -pupilRadius].map((height) => path([0, height]).side)
    raysTop = [pupilRadius, 0, -pupilRadius].map((height) => path([height, 0]).top)
    sections = sectionPlanes(beam.lensBack, setup.axialLength, planes ?? []).map((plane) => section(plane, ellipseAt(beam, plane, pupilRadius)))
  }
  // A ray that enters in the plane of a section stays in it when that plane holds a principal meridian of the system.
  const mixed = (matrix: Mat2) => Math.abs(matrix[1]) + Math.abs(matrix[2])
  const skew = mixed(beam.position) > 1e-9 * (Math.abs(beam.position[0]) + Math.abs(beam.position[3]) + 1e-12) || mixed(beam.entrance) > 1e-9

  const blurDiameter = equivalentBlurDiameter(pointSpread)
  return {
    glasses,
    vergence,
    accommodationNeeded,
    accommodation,
    lensState,
    lens,
    lensPower: lensPower(lens, media),
    totalPower: totalPower(setup.cornealRadius, lensState, media),
    focusDistance: focus,
    focusOffset: focus === null ? null : focus - setup.axialLength,
    focalLines,
    blur,
    blurDiameter,
    pointSpread,
    letterImageHeight,
    letterScale: scale2(beam.imageScale, -letterAngle),
    strokeWidth,
    sharpness: sharpnessOf(blurDiameter, strokeWidth),
    illuminance: 0,
    farPoint: objectDistanceFor(plan.error, glasses),
    nearPoint: objectDistanceFor(plan.error - plan.amplitude, glasses),
    rays,
    raysTop,
    skew,
    sections,
    sphericalAberration,
  }
}

/**
 * The eye looking at its object: how far it accommodates, where the light
 * comes to a focus, and what light an object point leaves on the retina. The
 * eye accommodates by itself as far as its age allows unless the lens is held.
 */
export function solveEye(setup: EyeSetup, widestPupil: number = setup.pupilDiameter): EyeSolution {
  const light = lightOf(setup)
  const error = refractiveError(setup, light.media)
  const amplitude = maxAccommodation(setup.age)
  const astigmatic = isAstigmatic(setup)
  const refraction = refractionMatrix(setup, light.media)
  const vertexDistance = setup.glasses?.vertexDistance ?? DEFAULT_VERTEX_DISTANCE

  const notices: string[] = []
  // Real rays are meridional: they exist only in an eye that is the same in every plane through its axis.
  const real = (setup.realRays ?? false) && !astigmatic && isSpherical(setup.glasses)
  if (setup.realRays && !real) notices.push('Real rays are traced only in an eye with one corneal radius and glasses without a cylinder: this eye is traced with paraxial rays.')
  const plan: Plan = { error, amplitude, media: light.media, bands: light.bands, real }

  if (ringOf(setup) > 0 && !real) notices.push('The ring stop selects a zone for real rays: with paraxial rays the pupil is open.')
  // The image of an extended object is as bright as the open area of the pupil.
  const illuminance = (setup.pupilDiameter / widestPupil) ** 2 * (real ? 1 - ringOf(setup) ** 2 : 1)
  const view = { ...viewOf(setup, setup.glasses, plan), illuminance }
  const blocked = 1 - Math.min(...view.pointSpread.map((component) => component.energy))
  if (blocked > 1e-9) notices.push(`${Math.round(100 * blocked)}% of the light through the pupil misses a surface of the eye or is totally reflected, and is not in the image.`)
  return {
    setup,
    cornealPower: cornealPower(setup.cornealRadius, light.media),
    cornealPowerCross: cornealPower(crossRadius(setup), light.media),
    relaxedLensPower: lensPower(lensShape(0), light.media),
    refractiveError: error,
    refraction: spheroCylinder(refraction),
    astigmatic,
    maxAccommodation: amplitude,
    correctingPower: correctingPower(error, vertexDistance),
    correctingLens: correctingLens(refraction, vertexDistance),
    wavelength: light.wavelength,
    chromaticDifference: setup.dispersion ? refractiveError(setup, mediaAt(CHROMATIC_LINES.red)) - refractiveError(setup, mediaAt(CHROMATIC_LINES.blue)) : null,
    realRays: real,
    notices,
    view,
    bare: setup.glasses ? { ...viewOf(setup, null, plan), illuminance } : null,
  }
}
