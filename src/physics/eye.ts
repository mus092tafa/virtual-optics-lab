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
import { DEFAULT_VERTEX_DISTANCE, EYE, HOFSTETTER_AVERAGE, LETTER_STROKES, SHARPNESS_LIMITS } from './constants'
import { compose, surfaceMatrix, thinLensMatrix, translation } from './rayTransfer'
import type { RayMatrix } from './rayTransfer'
import { correctingPower, objectVergence, vergenceAtCornea, vergenceAtGlassesFor } from './spectacles'
import type { Glasses } from './spectacles'

export interface EyeAnatomy {
  /** Corneal vertex to retina. */
  axialLength: number
  cornealRadius: number
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

/** Height of the edge of the lens, where its two spherical surfaces meet. */
export function lensEdgeHeight(shape: LensShape): number {
  let low = 0
  let high = Math.min(Math.abs(shape.frontRadius), Math.abs(shape.backRadius))
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2
    if (surfaceSag(shape.frontRadius, middle) + surfaceSag(shape.backRadius, middle) < shape.thickness) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** Power of the corneal surface, (n′ − n)/r. */
export function cornealPower(cornealRadius: number): number {
  return (EYE.humourIndex - 1) / cornealRadius
}

/** Equivalent power of the lens in the eye: P₁ + P₂ − (t/n) P₁ P₂. */
export function lensPower(shape: LensShape): number {
  const front = (EYE.lensIndex - EYE.humourIndex) / shape.frontRadius
  const back = (EYE.humourIndex - EYE.lensIndex) / shape.backRadius
  return front + back - (shape.thickness / EYE.lensIndex) * front * back
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

function eyeOptics(cornealRadius: number, shape: LensShape): EyeOptics {
  const toStop = compose(translation(shape.chamberDepth), surfaceMatrix(1, EYE.humourIndex, cornealRadius))
  const front = surfaceMatrix(EYE.humourIndex, EYE.lensIndex, shape.frontRadius)
  const back = surfaceMatrix(EYE.lensIndex, EYE.humourIndex, shape.backRadius)
  const toLensBack = compose(back, compose(translation(shape.thickness), compose(front, toStop)))
  return { toStop, toLensBack, lensBack: shape.chamberDepth + shape.thickness }
}

/** Equivalent power of the whole eye, −n′ C of its matrix. */
export function totalPower(cornealRadius: number, state: number): number {
  return -EYE.humourIndex * eyeOptics(cornealRadius, lensShape(state)).toLensBack[2]
}

/**
 * Where light of a given vergence at the cornea comes to a focus, measured
 * from the corneal vertex; null when it leaves the lens without converging.
 */
export function focusDistance(cornealRadius: number, state: number, vergence: number): number | null {
  const optics = eyeOptics(cornealRadius, lensShape(state))
  const [a, b, c, d] = optics.toLensBack
  // The ray of unit height from the axial object point has the slope −L.
  const height = a - b * vergence
  const slope = c - d * vergence
  return slope < 0 ? optics.lensBack - height / slope : null
}

/** The vergence at the cornea that the eye, at lens state a, focuses on its retina. */
export function focusedVergence(eye: EyeAnatomy, state: number): number {
  const optics = eyeOptics(eye.cornealRadius, lensShape(state))
  const [a, b, c, d] = optics.toLensBack
  const x = eye.axialLength - optics.lensBack
  return (a + x * c) / (b + x * d)
}

/** Refractive error K: the vergence of the relaxed eye's far point at the cornea (negative in myopia). */
export function refractiveError(eye: EyeAnatomy): number {
  return focusedVergence(eye, 0)
}

/** Accommodation of the lens state a, in dioptres at the cornea, relative to the relaxed eye. */
export function accommodationOf(eye: EyeAnatomy, state: number): number {
  return refractiveError(eye) - focusedVergence(eye, state)
}

/** The lens state that gives a wanted accommodation (which grows steadily with the state). */
export function stateForAccommodation(eye: EyeAnatomy, accommodation: number): number {
  if (accommodation <= 0) return 0
  let low = 0
  let high = MAX_LENS_STATE
  if (accommodationOf(eye, high) <= accommodation) return high
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2
    if (accommodationOf(eye, middle) < accommodation) low = middle
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
}

export interface RayPoint {
  x: number
  y: number
}

/** The eye looking at the object, with or without the glasses. */
export interface EyeView {
  glasses: Glasses | null
  /** Vergence of the object's light arriving at the cornea. */
  vergence: number
  /** Accommodation that would put the image on the retina (negative: the eye would have to relax beyond its relaxed state). */
  accommodationNeeded: number
  /** Accommodation of the lens as it is. */
  accommodation: number
  lensState: number
  lens: LensShape
  lensPower: number
  totalPower: number
  /** Focus of the object's light from the corneal vertex; null when it does not converge in the eye. */
  focusDistance: number | null
  /** Focus position minus the retina's: positive behind the retina. */
  focusOffset: number | null
  blurDiameter: number
  /** Height of one letter on the retina; negative because the retinal image is inverted. */
  letterImageHeight: number
  strokeWidth: number
  sharpness: Sharpness
  /** Retinal illuminance relative to the widest pupil offered. */
  illuminance: number
  /** Nearest and farthest object distances (from the cornea) this eye can focus in this view; Infinity for a distant limit, null when there is none in front of the eye. */
  farPoint: number | null
  nearPoint: number | null
  /**
   * Rays from the axial object point through the top, the centre and the bottom of the pupil, up to the retina or the
   * focus, whichever is farther. Each has a point in front of the first element, one at every element (glasses when
   * worn, cornea, front and back of the lens) and one at its end.
   */
  rays: RayPoint[][]
}

export interface EyeSolution {
  /** The eye, its object and its glasses as they were solved. */
  setup: EyeSetup
  cornealPower: number
  /** Power of the relaxed lens. */
  relaxedLensPower: number
  refractiveError: number
  maxAccommodation: number
  /** Spectacle power that corrects K, at the vertex distance of the glasses (the usual 12 mm when none are worn). */
  correctingPower: number
  view: EyeView
  /** The same eye and object without the glasses; null when none are worn. */
  bare: EyeView | null
}

/** Matrix from the first element (the glasses, or the cornea) to the cornea. */
function approach(glasses: Glasses | null): RayMatrix {
  if (!glasses) return [1, 0, 0, 1]
  const lens: RayMatrix = glasses.power === 0 ? [1, 0, 0, 1] : thinLensMatrix(1 / glasses.power)
  return compose(translation(glasses.vertexDistance), lens)
}

/** Object distance from the cornea at which the cornea receives a wanted vergence; null when no real object does that. */
function objectDistanceFor(wantedAtCornea: number, glasses: Glasses | null): number | null {
  const atFirst = glasses ? vergenceAtGlassesFor(wantedAtCornea, glasses) : wantedAtCornea
  if (atFirst > 1e-9) return null
  const offset = glasses?.vertexDistance ?? 0
  return Math.abs(atFirst) <= 1e-9 ? Infinity : -1 / atFirst + offset
}

function viewOf(setup: EyeSetup, glasses: Glasses | null, error: number, amplitude: number): EyeView {
  const offset = glasses?.vertexDistance ?? 0
  // Vergence and angular size of the object at the first element it meets.
  const distance = setup.objectDistance - offset
  const firstVergence = objectVergence(distance)
  const letterAngle = Number.isFinite(distance) ? setup.letterHeight / distance : setup.letterAngle
  const vergence = glasses ? vergenceAtCornea(firstVergence, glasses) : firstVergence

  const accommodationNeeded = error - vergence
  const wanted = setup.heldAccommodation ?? accommodationNeeded
  const accommodation = Math.min(amplitude, Math.max(0, wanted))
  const lensState = stateForAccommodation(setup, accommodation)
  const lens = lensShape(lensState)
  const optics = eyeOptics(setup.cornealRadius, lens)
  const entry = approach(glasses)
  const toStop = compose(optics.toStop, entry)
  const toRetina = compose(translation(setup.axialLength - optics.lensBack), compose(optics.toLensBack, entry))

  // A ray meeting the first element at height y from an object point at the angle α above the axis has the slope −L y − α.
  const at = (matrix: RayMatrix, y: number, angle: number) => matrix[0] * y + matrix[1] * (-firstVergence * y - angle)
  // Marginal ray of the axial point: the one that passes the edge of the pupil.
  const marginal = setup.pupilDiameter / 2 / at(toStop, 1, 0)
  const blurDiameter = 2 * Math.abs(at(toRetina, marginal, 0))
  // Chief ray of the top of a letter: the one through the centre of the pupil.
  const chief = (toStop[1] * letterAngle) / (toStop[0] - toStop[1] * firstVergence)
  const letterImageHeight = at(toRetina, chief, letterAngle)
  const strokeWidth = Math.abs(letterImageHeight) / LETTER_STROKES

  const focus = focusDistance(setup.cornealRadius, lensState, vergence)
  const end = Math.max(setup.axialLength, focus ?? 0)
  const rays = [marginal, 0, -marginal].map((height) => tracePath(setup, glasses, lens, height, -firstVergence * height, end))

  return {
    glasses,
    vergence,
    accommodationNeeded,
    accommodation,
    lensState,
    lens,
    lensPower: lensPower(lens),
    totalPower: -EYE.humourIndex * optics.toLensBack[2],
    focusDistance: focus,
    focusOffset: focus === null ? null : focus - setup.axialLength,
    blurDiameter,
    letterImageHeight,
    strokeWidth,
    sharpness: sharpnessOf(blurDiameter, strokeWidth),
    illuminance: 0,
    farPoint: objectDistanceFor(error, glasses),
    nearPoint: objectDistanceFor(error - amplitude, glasses),
    rays,
  }
}

/** Length of the incoming ray given before the first element. */
const RAY_LEAD = 0.01

/** The ray (y, u) at the first element followed through every surface to the plane x = end. */
function tracePath(setup: EyeAnatomy, glasses: Glasses | null, lens: LensShape, y: number, u: number, end: number): RayPoint[] {
  const points: RayPoint[] = []
  let x = glasses ? -glasses.vertexDistance : 0
  let ray: [number, number] = [y, u]
  const through = (matrix: RayMatrix) => {
    ray = [matrix[0] * ray[0] + matrix[1] * ray[1], matrix[2] * ray[0] + matrix[3] * ray[1]]
  }
  const advance = (to: number) => {
    through(translation(to - x))
    x = to
  }
  const mark = () => points.push({ x, y: ray[0] })
  // Where the ray comes from, a short way in front of the first element.
  points.push({ x: x - RAY_LEAD, y: y - u * RAY_LEAD })
  mark()
  if (glasses) {
    if (glasses.power !== 0) through(thinLensMatrix(1 / glasses.power))
    advance(0)
    mark()
  }
  through(surfaceMatrix(1, EYE.humourIndex, setup.cornealRadius))
  advance(lens.chamberDepth)
  mark()
  through(surfaceMatrix(EYE.humourIndex, EYE.lensIndex, lens.frontRadius))
  advance(lens.chamberDepth + lens.thickness)
  mark()
  through(surfaceMatrix(EYE.lensIndex, EYE.humourIndex, lens.backRadius))
  advance(end)
  mark()
  return points
}

/**
 * The eye looking at its object: how far it accommodates, where the light
 * comes to a focus, and how large the blur on the retina is. The eye
 * accommodates by itself as far as its age allows unless the lens is held.
 */
export function solveEye(setup: EyeSetup, widestPupil: number = setup.pupilDiameter): EyeSolution {
  const error = refractiveError(setup)
  const amplitude = maxAccommodation(setup.age)
  // The image of an extended object is as bright as the area of the pupil.
  const illuminance = (setup.pupilDiameter / widestPupil) ** 2
  const view = { ...viewOf(setup, setup.glasses, error, amplitude), illuminance }
  return {
    setup,
    cornealPower: cornealPower(setup.cornealRadius),
    relaxedLensPower: lensPower(lensShape(0)),
    refractiveError: error,
    maxAccommodation: amplitude,
    correctingPower: correctingPower(error, setup.glasses?.vertexDistance ?? DEFAULT_VERTEX_DISTANCE),
    view,
    bare: setup.glasses ? { ...viewOf(setup, null, error, amplitude), illuminance } : null,
  }
}
