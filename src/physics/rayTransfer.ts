/**
 * Geometrical optics: paraxial ray-transfer (ABCD) matrices.
 *
 * A ray is (y, u): height above the axis and slope. An optical system maps
 *   y' = A y + B u
 *   u' = C y + D u
 *
 * This is the general engine behind image formation and defocus for any
 * sequence of thin elements on the axis, so compound systems need no special
 * cases. New element types only have to provide their matrix.
 */
import { imageDistance } from './lenses'
import type { Point } from './lenses'

export type RayMatrix = readonly [A: number, B: number, C: number, D: number]

export const IDENTITY: RayMatrix = [1, 0, 0, 1]

export const translation = (distance: number): RayMatrix => [1, distance, 0, 1]

export const thinLensMatrix = (focalLength: number): RayMatrix => [1, 0, -1 / focalLength, 1]

/** Matrix of `first` followed by `second`. */
export function compose(second: RayMatrix, first: RayMatrix): RayMatrix {
  const [a2, b2, c2, d2] = second
  const [a1, b1, c1, d1] = first
  return [a2 * a1 + b2 * c1, a2 * b1 + b2 * d1, c2 * a1 + d2 * c1, c2 * b1 + d2 * d1]
}

export interface AxialLens {
  x: number
  focalLength: number
  aperture: number
}

/** Lenses strictly between two planes, ordered along the axis. */
export function lensesBetween<T extends AxialLens>(lenses: readonly T[], xFrom: number, xTo: number): T[] {
  return lenses.filter((lens) => lens.x > xFrom && lens.x < xTo).sort((a, b) => a.x - b.x)
}

/** Ray-transfer matrix from the plane xFrom to the plane xTo. */
export function systemMatrix(lenses: readonly AxialLens[], xFrom: number, xTo: number): RayMatrix {
  let matrix: RayMatrix = IDENTITY
  let x = xFrom
  for (const lens of lensesBetween(lenses, xFrom, xTo)) {
    matrix = compose(translation(lens.x - x), matrix)
    matrix = compose(thinLensMatrix(lens.focalLength), matrix)
    x = lens.x
  }
  return compose(translation(xTo - x), matrix)
}

/** Polyline of a paraxial ray launched from (xFrom, y) with slope u. */
export function traceRay(
  lenses: readonly AxialLens[],
  xFrom: number,
  xTo: number,
  y: number,
  u: number,
): Point[] {
  const points: Point[] = [{ x: xFrom, y }]
  let x = xFrom
  let height = y
  let slope = u
  for (const lens of lensesBetween(lenses, xFrom, xTo)) {
    height += slope * (lens.x - x)
    slope -= height / lens.focalLength
    x = lens.x
    points.push({ x, y: height })
  }
  points.push({ x: xTo, y: height + slope * (xTo - x) })
  return points
}

export interface ImagingStage {
  lensX: number
  focalLength: number
  /** Negative for a virtual object (converging light intercepted by the lens). */
  objectDistance: number
  imageDistance: number
  magnification: number
  imageX: number
  isReal: boolean
}

export interface SequentialImage {
  stages: ImagingStage[]
  /** Axial position of the final image (±Infinity for collimated output). */
  imageX: number
  /** Total lateral magnification (NaN-free; ±Infinity for an image at infinity). */
  magnification: number
  isReal: boolean
  atInfinity: boolean
}

/**
 * Applies the thin lens equation to each lens in turn: the image formed by one
 * lens is the object for the next.
 */
export function sequentialImaging(lenses: readonly AxialLens[], objectX: number): SequentialImage | null {
  const ordered = lensesBetween(lenses, objectX, Infinity)
  if (ordered.length === 0) return null
  const stages: ImagingStage[] = []
  let currentObjectX = objectX
  for (const lens of ordered) {
    const objectDistance = lens.x - currentObjectX
    const di = imageDistance(lens.focalLength, objectDistance)
    stages.push({
      lensX: lens.x,
      focalLength: lens.focalLength,
      objectDistance,
      imageDistance: di,
      magnification: Number.isFinite(objectDistance) ? -di / objectDistance : 0,
      imageX: lens.x + di,
      isReal: di > 0,
    })
    currentObjectX = lens.x + di
  }
  const last = stages[stages.length - 1]
  const atInfinity = !Number.isFinite(last.imageDistance)
  // Total magnification from the system matrix evaluated at the image plane
  // (B = 0 there, so y' = A y). Robust against intermediate images at infinity.
  let matrix: RayMatrix = IDENTITY
  let x = objectX
  for (const lens of ordered) {
    matrix = compose(translation(lens.x - x), matrix)
    matrix = compose(thinLensMatrix(lens.focalLength), matrix)
    x = lens.x
  }
  const totalMagnification = atInfinity ? Infinity : matrix[0] + last.imageDistance * matrix[2]
  return {
    stages,
    imageX: last.imageX,
    magnification: totalMagnification,
    isReal: last.isReal,
    atInfinity,
  }
}

export interface ScreenProjection {
  matrix: RayMatrix
  /** Half-angle of the ray cone from an axial object point accepted by the lens apertures. */
  marginalSlope: number
  /**
   * Scale of the (possibly blurred) picture on the screen: where the chief ray
   * from an object point of height y lands, divided by y. Equals the lateral
   * magnification when the screen is in the image plane.
   */
  scale: number
  /** Diameter of the geometric blur circle from one object point. */
  blurDiameter: number
}

/**
 * What a screen at screenX receives from an object at objectX.
 *
 * A point at height y emits rays of slope u; they reach the screen at
 * A y + B u. The image is sharp iff B = 0. Otherwise the accepted cone of
 * slopes (limited by the aperture stop) is smeared over a disc of diameter
 * 2 |B| u_max centred on the chief ray.
 */
export function projectOntoScreen(
  lenses: readonly AxialLens[],
  objectX: number,
  screenX: number,
): ScreenProjection | null {
  const ordered = lensesBetween(lenses, objectX, screenX)
  if (ordered.length === 0) return null

  // Find the aperture stop: the lens that most restricts the axial ray cone.
  let marginalSlope = Infinity
  let stopA = 1
  let stopB = 1
  let matrix: RayMatrix = IDENTITY
  let x = objectX
  for (const lens of ordered) {
    matrix = compose(translation(lens.x - x), matrix)
    const [a, b] = matrix
    if (Math.abs(b) > 1e-12) {
      const limit = lens.aperture / 2 / Math.abs(b)
      if (limit < marginalSlope) {
        marginalSlope = limit
        stopA = a
        stopB = b
      }
    }
    matrix = compose(thinLensMatrix(lens.focalLength), matrix)
    x = lens.x
  }
  matrix = compose(translation(screenX - x), matrix)
  if (!Number.isFinite(marginalSlope)) return null

  const [A, B] = matrix
  // The chief ray passes through the centre of the stop: u = −(A_stop / B_stop) y.
  const scale = A - (B * stopA) / stopB
  return { matrix, marginalSlope, scale, blurDiameter: 2 * Math.abs(B) * marginalSlope }
}
