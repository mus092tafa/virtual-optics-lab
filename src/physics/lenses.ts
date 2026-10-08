/**
 * Geometrical optics: thin lens in the paraxial approximation.
 *
 * Sign convention ("real is positive"):
 *   do > 0  object on the incoming side of the lens (real object)
 *   di > 0  image on the outgoing side (real image), di < 0 virtual image
 *   f  > 0  converging (convex) lens, f < 0 diverging lens
 *
 *   1/f = 1/do + 1/di        m = hi/ho = −di/do
 */

export type ImageOrientation = 'inverted' | 'upright'
export type ImageSize = 'magnified' | 'reduced' | 'same size'

export interface ThinLensImage {
  focalLength: number
  objectDistance: number
  /** ±Infinity when the object sits in the focal plane. */
  imageDistance: number
  magnification: number
  isReal: boolean
  atInfinity: boolean
  orientation: ImageOrientation
  size: ImageSize
}

/** Thin lens equation solved for the image distance. */
export function imageDistance(focalLength: number, objectDistance: number): number {
  const vergence = 1 / focalLength - 1 / objectDistance
  if (Math.abs(vergence) < 1e-12) return Infinity
  return 1 / vergence
}

/** Lateral magnification m = −di/do. */
export function magnification(objectDistance: number, imageDist: number): number {
  return -imageDist / objectDistance
}

/** Thin lens equation solved for f from a measured conjugate pair. */
export function focalLengthFromConjugates(objectDistance: number, imageDist: number): number {
  return 1 / (1 / objectDistance + 1 / imageDist)
}

export function thinLensImage(focalLength: number, objectDistance: number): ThinLensImage {
  const di = imageDistance(focalLength, objectDistance)
  const mag = magnification(objectDistance, di)
  const absMag = Math.abs(mag)
  return {
    focalLength,
    objectDistance,
    imageDistance: di,
    magnification: mag,
    isReal: di > 0,
    atInfinity: !Number.isFinite(di),
    orientation: mag < 0 ? 'inverted' : 'upright',
    size: Math.abs(absMag - 1) < 1e-9 ? 'same size' : absMag > 1 ? 'magnified' : 'reduced',
  }
}

/**
 * Geometric defocus: diameter of the blur circle that a point object produces
 * on a screen a distance `screenDistance` behind a lens of clear aperture
 * `aperture`. The cone of rays converging on the image point is cut by the
 * screen; by similar triangles
 *
 *   c = D · |screenDistance − di| / |di| = D · |1 − s (1/f − 1/do)|
 *
 * which is zero exactly at the image plane.
 */
export function blurCircleDiameter(
  aperture: number,
  focalLength: number,
  objectDistance: number,
  screenDistance: number,
): number {
  return aperture * Math.abs(1 - screenDistance * (1 / focalLength - 1 / objectDistance))
}

export interface Point {
  x: number
  y: number
}

export interface Segment {
  from: Point
  to: Point
}

export interface PrincipalRay {
  kind: 'parallel' | 'central' | 'focal'
  /** Object tip to the lens plane. */
  incoming: Segment
  /** Lens plane onward. */
  outgoing: Segment
  /** Backward extension of the outgoing ray to a virtual image point. */
  virtualExtension: Segment | null
  /** Backward extension of the incoming ray to the front focal point. */
  incomingExtension: Segment | null
}

/**
 * The three principal rays from an object tip at (objectX, objectHeight)
 * through a thin lens at lensX, generated from the lens law:
 *
 *   parallel  enters parallel to the axis, leaves through the back focal point
 *   central   passes through the optical centre undeviated
 *   focal     aimed at the front focal point, leaves parallel to the axis
 *
 * Outgoing rays are extended to `xEnd`. Requires a real object (do > 0).
 */
export function principalRays(
  lensX: number,
  focalLength: number,
  objectX: number,
  objectHeight: number,
  xEnd: number,
): PrincipalRay[] {
  const objectDistance = lensX - objectX
  if (objectDistance <= 0) return []
  const image = thinLensImage(focalLength, objectDistance)
  const tip: Point = { x: objectX, y: objectHeight }
  const end = Math.max(xEnd, lensX)
  const virtualPoint: Point | null =
    !image.isReal && !image.atInfinity
      ? { x: lensX + image.imageDistance, y: image.magnification * objectHeight }
      : null

  const build = (
    kind: PrincipalRay['kind'],
    lensHeight: number,
    outgoingSlope: number,
    incomingExtension: Segment | null,
  ): PrincipalRay => {
    const atLens: Point = { x: lensX, y: lensHeight }
    return {
      kind,
      incoming: { from: tip, to: atLens },
      outgoing: { from: atLens, to: { x: end, y: lensHeight + outgoingSlope * (end - lensX) } },
      virtualExtension: virtualPoint ? { from: atLens, to: virtualPoint } : null,
      incomingExtension,
    }
  }

  const rays: PrincipalRay[] = [
    build('parallel', objectHeight, -objectHeight / focalLength, null),
    build('central', 0, -objectHeight / objectDistance, null),
  ]

  // The focal ray is undefined when the object lies in the front focal plane.
  if (Math.abs(objectDistance - focalLength) > 1e-9) {
    const lensHeight = (-objectHeight * focalLength) / (objectDistance - focalLength)
    const frontFocus: Point = { x: lensX - focalLength, y: 0 }
    // Inside the focal length (or for a diverging lens) the ray only appears to
    // come from / head towards the focal point.
    const extension: Segment | null =
      focalLength > 0 && objectDistance < focalLength
        ? { from: frontFocus, to: tip }
        : focalLength < 0
          ? { from: { x: lensX, y: lensHeight }, to: frontFocus }
          : null
    rays.push(build('focal', lensHeight, 0, extension))
  }
  return rays
}
