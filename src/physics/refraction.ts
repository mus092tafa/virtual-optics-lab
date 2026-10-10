/**
 * Geometrical optics: refraction at a planar interface between two
 * homogeneous, isotropic, non-absorbing media.
 * Angles are measured from the surface normal, in radians.
 */
import { dot } from './reflection'
import type { Vec2 } from './reflection'

/**
 * Snell's law: n₁ sin θ₁ = n₂ sin θ₂.
 * Returns the refraction angle, or null under total internal reflection.
 */
export function refractionAngle(n1: number, n2: number, incidentAngle: number): number | null {
  const sine = (n1 / n2) * Math.sin(incidentAngle)
  if (Math.abs(sine) > 1) return null
  return Math.asin(sine)
}

/** Critical angle for total internal reflection; null when n₁ ≤ n₂. */
export function criticalAngle(n1: number, n2: number): number | null {
  if (n1 <= n2) return null
  return Math.asin(n2 / n1)
}

/** Brewster angle: reflected p-polarised light vanishes at tan θ_B = n₂ / n₁. */
export function brewsterAngle(n1: number, n2: number): number {
  return Math.atan2(n2, n1)
}

/** Index of the second medium from a measured Brewster angle: n₂ = n₁ tan θ_B. */
export function indexFromBrewsterAngle(n1: number, angle: number): number {
  return n1 * Math.tan(angle)
}

/** Index of the second medium from a measured pair of angles. */
export function indexFromAngles(n1: number, incidentAngle: number, refractedAngle: number): number {
  return (n1 * Math.sin(incidentAngle)) / Math.sin(refractedAngle)
}

export interface FresnelCoefficients {
  /** Power reflectance for s-polarisation. */
  Rs: number
  /** Power reflectance for p-polarisation. */
  Rp: number
  /** Unpolarised power reflectance, (Rs + Rp) / 2. */
  R: number
  /** Unpolarised power transmittance, 1 − R. */
  T: number
}

/** Fresnel equations for the power reflected and transmitted at the interface. */
export function fresnel(n1: number, n2: number, incidentAngle: number): FresnelCoefficients {
  const refracted = refractionAngle(n1, n2, incidentAngle)
  if (refracted === null) return { Rs: 1, Rp: 1, R: 1, T: 0 }
  const cosI = Math.cos(incidentAngle)
  const cosT = Math.cos(refracted)
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT)
  const rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT)
  const Rs = rs * rs
  const Rp = rp * rp
  const R = (Rs + Rp) / 2
  return { Rs, Rp, R, T: 1 - R }
}

/**
 * Vector form of Snell's law.
 * `direction` is the unit propagation direction; `normal` is the unit normal
 * pointing back into the incident medium (normal·direction < 0).
 * Returns null under total internal reflection.
 */
export function refractVector(direction: Vec2, normal: Vec2, n1: number, n2: number): Vec2 | null {
  const eta = n1 / n2
  const cosI = -dot(normal, direction)
  const k = 1 - eta * eta * (1 - cosI * cosI)
  if (k < 0) return null
  const factor = eta * cosI - Math.sqrt(k)
  return { x: eta * direction.x + factor * normal.x, y: eta * direction.y + factor * normal.y }
}
