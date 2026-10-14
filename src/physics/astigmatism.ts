/**
 * Paraxial optics of systems that are not rotationally symmetric: a toric
 * surface, a cylinder lens, and any sequence of them at any orientation.
 *
 * A ray has a two-component height y and slope u. Seen facing the eye, x
 * points to the right and y up; angles run counter-clockwise from x (the
 * notation of a prescription). A curvature or a power is then a symmetric
 * 2 × 2 matrix, and the ray-transfer matrix of ordinary paraxial optics
 * becomes one of 2 × 2 blocks. See docs/PHYSICS.md, "Astigmatism".
 */

export type Vec2 = readonly [x: number, y: number]
/** Row by row: [a b; c d]. */
export type Mat2 = readonly [a: number, b: number, c: number, d: number]

export const UNIT: Mat2 = [1, 0, 0, 1]
export const scale2 = (m: Mat2, k: number): Mat2 => [m[0] * k, m[1] * k, m[2] * k, m[3] * k]
export const add2 = (m: Mat2, n: Mat2): Mat2 => [m[0] + n[0], m[1] + n[1], m[2] + n[2], m[3] + n[3]]
export const mul2 = (m: Mat2, n: Mat2): Mat2 => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3]]
export const det2 = (m: Mat2): number => m[0] * m[3] - m[1] * m[2]
export const apply2 = (m: Mat2, v: Vec2): Vec2 => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]]

export function inverse2(m: Mat2): Mat2 {
  const det = det2(m)
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det]
}

/** The symmetric matrix with the value `along` in the meridian at the angle and `across` at right angles to it. */
export function meridianMatrix(along: number, across: number, angle: number): Mat2 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const mixed = (along - across) * c * s
  return [along * c * c + across * s * s, mixed, mixed, along * s * s + across * c * c]
}

/** A lens or a refractive error as it is written in a prescription. */
export interface SpheroCylinder {
  /** Power along the axis, dioptres. */
  sphere: number
  /** Power added in the meridian at right angles to the axis. */
  cylinder: number
  /** Radians, from 0 to π. */
  axis: number
}

/** Power matrix F = S·1 + C·[sin²a, −sin a cos a; −sin a cos a, cos²a]. */
export function powerMatrix(lens: SpheroCylinder): Mat2 {
  return meridianMatrix(lens.sphere, lens.sphere + lens.cylinder, lens.axis)
}

/** Cylinders smaller than this are written as none. */
const NO_CYLINDER = 1e-9

/** A symmetric power matrix as sphere, negative cylinder and axis: the sphere is its larger principal power. */
export function spheroCylinder(m: Mat2): SpheroCylinder {
  const mixed = (m[1] + m[2]) / 2
  const mean = (m[0] + m[3]) / 2
  const half = Math.hypot((m[0] - m[3]) / 2, mixed)
  if (half < NO_CYLINDER) return { sphere: mean, cylinder: 0, axis: 0 }
  const axis = 0.5 * Math.atan2(2 * mixed, m[0] - m[3])
  return { sphere: mean + half, cylinder: -2 * half, axis: ((axis % Math.PI) + Math.PI) % Math.PI }
}

/** The image of the unit circle under m: its two semi-axes, larger first, and the direction of the larger. */
export function principalAxes(m: Mat2): { major: number; minor: number; angle: number } {
  // Eigenvalues of m mᵀ are the squares of the semi-axes.
  const a = m[0] * m[0] + m[1] * m[1]
  const b = m[0] * m[2] + m[1] * m[3]
  const d = m[2] * m[2] + m[3] * m[3]
  const mean = (a + d) / 2
  const half = Math.hypot((a - d) / 2, b)
  const angle = half > 0 ? 0.5 * Math.atan2(2 * b, a - d) : 0
  return { major: Math.sqrt(Math.max(0, mean + half)), minor: Math.sqrt(Math.max(0, mean - half)), angle: ((angle % Math.PI) + Math.PI) % Math.PI }
}

/** Ray-transfer matrix [A B; C D] of 2 × 2 blocks: y′ = A y + B u, u′ = C y + D u. */
export interface RayBlocks {
  a: Mat2
  b: Mat2
  c: Mat2
  d: Mat2
}

const ZERO: Mat2 = [0, 0, 0, 0]
export const NO_ELEMENT: RayBlocks = { a: UNIT, b: ZERO, c: ZERO, d: UNIT }

export const gap = (distance: number): RayBlocks => ({ a: UNIT, b: scale2(UNIT, distance), c: ZERO, d: UNIT })

/** Refraction at a surface of curvature matrix C from index n into n′: u′ = (n/n′) u − ((n′ − n)/n′) C y. */
export const toricSurface = (n: number, nPrime: number, curvature: Mat2): RayBlocks => ({ a: UNIT, b: ZERO, c: scale2(curvature, -(nPrime - n) / nPrime), d: scale2(UNIT, n / nPrime) })

/** A thin lens of power matrix F in air: u′ = u − F y. */
export const thinAstigmaticLens = (power: Mat2): RayBlocks => ({ a: UNIT, b: ZERO, c: scale2(power, -1), d: UNIT })

/** The element `first` followed by `second`. */
export function composeBlocks(second: RayBlocks, first: RayBlocks): RayBlocks {
  return {
    a: add2(mul2(second.a, first.a), mul2(second.b, first.c)),
    b: add2(mul2(second.a, first.b), mul2(second.b, first.d)),
    c: add2(mul2(second.c, first.a), mul2(second.d, first.c)),
    d: add2(mul2(second.c, first.b), mul2(second.d, first.d)),
  }
}
