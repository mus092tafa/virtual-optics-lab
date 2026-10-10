/**
 * Geometrical optics: a ray refracted through a triangular prism in air.
 *
 *   first face:   sin θ₁ = n sin θ₁′
 *   inside:       θ₁′ + θ₂′ = A                 (A: apex angle)
 *   second face:  n sin θ₂′ = sin θ₂
 *   deviation:    δ = θ₁ + θ₂ − A
 *
 * δ is smallest for the symmetric passage θ₁ = θ₂, where
 *   n = sin((A + δ_min)/2) / sin(A/2).
 *
 * Geometry is in units of the side length of the prism: the apex is at the
 * top, the two refracting faces have length 1 and meet at the apex angle.
 */
import type { Vec2 } from './reflection'
import { reflectVector } from './reflection'
import { fresnel, refractVector } from './refraction'

/** Where along the first face, measured from the apex, the ray enters. */
export const PRISM_ENTRY_FRACTION = 0.45

export interface PrismSetup {
  /** Apex angle A between the two refracting faces. */
  apexAngle: number
  /** Angle of incidence θ₁ on the first face, from its normal, on the base side. */
  incidenceAngle: number
  /** Refractive index of the glass at the wavelength of the ray. */
  index: number
}

export type PrismOutcome = 'transmitted' | 'total-internal-reflection' | 'misses-second-face'

export interface PrismSolution {
  outcome: PrismOutcome
  /** Corners: apex, left base corner, right base corner. */
  vertices: [Vec2, Vec2, Vec2]
  /** Point of incidence on the first face. */
  entry: Vec2
  /** Unit propagation directions. */
  incident: Vec2
  inside: Vec2
  /** Where the internal ray meets the second face (or the base, if it misses). */
  exit: Vec2
  emergent: Vec2 | null
  /** Internally reflected direction at the second face (total internal reflection only). */
  internalReflection: Vec2 | null
  /** Unit outward normals of the first and second face. */
  normal1: Vec2
  normal2: Vec2
  refractionAngle1: number
  /** Internal angle of incidence θ₂′ on the second face. */
  incidenceAngle2: number | null
  /** Angle of emergence θ₂. */
  emergenceAngle: number | null
  /** Total deviation δ of the ray. */
  deviation: number | null
  /** Fraction of the incident power in the emergent ray (unpolarised, both faces). */
  transmittance: number
}

/** Minimum deviation δ_min = 2 sin⁻¹(n sin(A/2)) − A. Null when no ray can pass symmetrically. */
export function minimumDeviation(apexAngle: number, index: number): number | null {
  const sine = index * Math.sin(apexAngle / 2)
  if (sine >= 1) return null
  return 2 * Math.asin(sine) - apexAngle
}

/** Angle of incidence for the symmetric (minimum-deviation) passage. */
export function incidenceAtMinimumDeviation(apexAngle: number, index: number): number | null {
  const sine = index * Math.sin(apexAngle / 2)
  if (sine >= 1) return null
  return Math.asin(sine)
}

/** n = sin((A + δ_min)/2) / sin(A/2). */
export function indexFromMinimumDeviation(apexAngle: number, deviation: number): number {
  return Math.sin((apexAngle + deviation) / 2) / Math.sin(apexAngle / 2)
}

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x

export function solvePrism(setup: PrismSetup): PrismSolution {
  const { apexAngle, incidenceAngle, index } = setup
  const half = apexAngle / 2
  const apex: Vec2 = { x: 0, y: Math.cos(half) }
  const left: Vec2 = { x: -Math.sin(half), y: 0 }
  const right: Vec2 = { x: Math.sin(half), y: 0 }
  const normal1: Vec2 = { x: -Math.cos(half), y: Math.sin(half) }
  const normal2: Vec2 = { x: Math.cos(half), y: Math.sin(half) }

  const entry: Vec2 = {
    x: apex.x + PRISM_ENTRY_FRACTION * (left.x - apex.x),
    y: apex.y + PRISM_ENTRY_FRACTION * (left.y - apex.y),
  }
  // The ray arrives from the base side of the normal: its direction is the
  // inward normal turned by θ₁ towards the apex.
  const incidentPolar = -half + incidenceAngle
  const incident: Vec2 = { x: Math.cos(incidentPolar), y: Math.sin(incidentPolar) }
  // Refraction into glass always succeeds (n > 1).
  const inside = refractVector(incident, normal1, 1, index)!
  const refractionAngle1 = Math.asin(Math.sin(incidenceAngle) / index)
  const first = fresnel(1, index, incidenceAngle)

  const base: PrismSolution = {
    outcome: 'misses-second-face',
    vertices: [apex, left, right],
    entry,
    incident,
    inside,
    exit: entry,
    emergent: null,
    internalReflection: null,
    normal1,
    normal2,
    refractionAngle1,
    incidenceAngle2: null,
    emergenceAngle: null,
    deviation: null,
    transmittance: 0,
  }

  // Intersection of the internal ray with the second face (apex -> right corner).
  const face: Vec2 = { x: right.x - apex.x, y: right.y - apex.y }
  const toApex: Vec2 = { x: apex.x - entry.x, y: apex.y - entry.y }
  const denominator = cross(inside, face)
  const along = denominator === 0 ? -1 : cross(toApex, face) / denominator
  const onFace = denominator === 0 ? -1 : cross(toApex, inside) / denominator
  if (along <= 0 || onFace <= 0 || onFace >= 1) {
    // The ray leaves through the base: follow it there so the scene can draw it.
    const toBase = inside.y < 0 ? -entry.y / inside.y : 0
    return { ...base, exit: { x: entry.x + toBase * inside.x, y: entry.y + toBase * inside.y } }
  }
  const exit: Vec2 = { x: entry.x + along * inside.x, y: entry.y + along * inside.y }
  const cosine = inside.x * normal2.x + inside.y * normal2.y
  const incidenceAngle2 = Math.acos(Math.min(1, Math.abs(cosine)))
  // Normal pointing back into the glass for the second refraction.
  const inward: Vec2 = { x: -normal2.x, y: -normal2.y }
  const emergent = refractVector(inside, inward, index, 1)
  if (!emergent) {
    return {
      ...base,
      outcome: 'total-internal-reflection',
      exit,
      incidenceAngle2,
      internalReflection: reflectVector(inside, normal2),
    }
  }
  const emergenceAngle = Math.acos(Math.min(1, emergent.x * normal2.x + emergent.y * normal2.y))
  const second = fresnel(index, 1, incidenceAngle2)
  return {
    ...base,
    outcome: 'transmitted',
    exit,
    emergent,
    incidenceAngle2,
    emergenceAngle,
    // Clockwise turn from the incident to the emergent direction.
    deviation: Math.atan2(cross(emergent, incident), emergent.x * incident.x + emergent.y * incident.y),
    transmittance: first.T * second.T,
  }
}
