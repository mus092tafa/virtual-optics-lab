/**
 * Geometrical optics: specular reflection.
 * Angles are measured from the surface normal, in radians.
 */

export interface Vec2 {
  x: number
  y: number
}

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

export function normalize(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y)
  return { x: v.x / length, y: v.y / length }
}

/** Law of reflection: θr = θi. */
export function reflectionAngle(incidentAngle: number): number {
  return incidentAngle
}

/**
 * Reflects a propagation direction off a surface with unit normal `normal`:
 *   r = d − 2 (d·n) n
 */
export function reflectVector(direction: Vec2, normal: Vec2): Vec2 {
  const projection = 2 * dot(direction, normal)
  return { x: direction.x - projection * normal.x, y: direction.y - projection * normal.y }
}

/** Unsigned angle between a propagation direction and the surface normal line. */
export function angleFromNormal(direction: Vec2, normal: Vec2): number {
  const cosine = Math.abs(dot(normalize(direction), normalize(normal)))
  return Math.acos(Math.min(1, cosine))
}

/** Rotating a mirror by α turns the reflected ray by 2α. */
export function reflectedRayRotation(mirrorRotation: number): number {
  return 2 * mirrorRotation
}
