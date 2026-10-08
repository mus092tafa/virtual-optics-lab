/**
 * Geometrical optics: a single ray meeting a plane mirror or a planar
 * interface between two media (the reflection / refraction experiments).
 *
 * Coordinates: the point of incidence is the origin, x to the right, y up.
 * The surface passes through the origin, tilted by `surfaceTilt` from the
 * horizontal; its normal n̂ = (−sin t, cos t) points into medium 1.
 */
import { material } from './constants'
import { angleFromNormal, dot, reflectVector } from './reflection'
import type { Vec2 } from './reflection'
import { criticalAngle, fresnel, refractVector } from './refraction'

export interface SurfaceSetup {
  kind: 'mirror' | 'interface'
  /** Tilt of the surface from horizontal, radians (counter-clockwise positive). */
  surfaceTilt: number
  /** Polar angle of the ray source as seen from the point of incidence. */
  sourceAngle: number
  /** Medium on the side the normal points to. */
  medium1: string
  /** Medium on the far side (interface only). */
  medium2: string
}

export interface SurfaceSolution {
  normal: Vec2
  /** Unit propagation direction of the incident ray. */
  incident: Vec2
  /** True when the ray arrives from the medium-1 (normal) side. */
  fromFront: boolean
  incidentAngle: number
  reflected: Vec2 | null
  reflectedAngle: number | null
  refracted: Vec2 | null
  refractedAngle: number | null
  /** Indices of the medium the ray starts in and the one beyond the surface. */
  nIncident: number
  nTransmitted: number | null
  criticalAngle: number | null
  totalInternalReflection: boolean
  /** Fraction of the incident power in the reflected / refracted ray. */
  reflectance: number
  transmittance: number
}

export function surfaceNormal(surfaceTilt: number): Vec2 {
  return { x: -Math.sin(surfaceTilt), y: Math.cos(surfaceTilt) }
}

export function solveSurface(setup: SurfaceSetup): SurfaceSolution {
  const normal = surfaceNormal(setup.surfaceTilt)
  const toSource: Vec2 = { x: Math.cos(setup.sourceAngle), y: Math.sin(setup.sourceAngle) }
  const incident: Vec2 = { x: -toSource.x, y: -toSource.y }
  const fromFront = dot(toSource, normal) >= 0
  const incidentAngle = angleFromNormal(incident, normal)
  const n1 = material(setup.medium1).n
  const n2 = material(setup.medium2).n

  if (setup.kind === 'mirror') {
    // A front-surface mirror: light arriving from behind is absorbed by the backing.
    const reflected = fromFront ? reflectVector(incident, normal) : null
    return {
      normal,
      incident,
      fromFront,
      incidentAngle,
      reflected,
      reflectedAngle: reflected ? angleFromNormal(reflected, normal) : null,
      refracted: null,
      refractedAngle: null,
      nIncident: n1,
      nTransmitted: null,
      criticalAngle: null,
      totalInternalReflection: false,
      reflectance: reflected ? 1 : 0,
      transmittance: 0,
    }
  }

  const nIncident = fromFront ? n1 : n2
  const nTransmitted = fromFront ? n2 : n1
  // Normal pointing back into the incident medium.
  const facing: Vec2 = fromFront ? normal : { x: -normal.x, y: -normal.y }
  const reflected = reflectVector(incident, facing)
  const refracted = refractVector(incident, facing, nIncident, nTransmitted)
  const coefficients = fresnel(nIncident, nTransmitted, incidentAngle)
  return {
    normal,
    incident,
    fromFront,
    incidentAngle,
    reflected,
    reflectedAngle: angleFromNormal(reflected, normal),
    refracted,
    refractedAngle: refracted ? angleFromNormal(refracted, normal) : null,
    nIncident,
    nTransmitted,
    criticalAngle: criticalAngle(nIncident, nTransmitted),
    totalInternalReflection: refracted === null,
    reflectance: coefficients.R,
    transmittance: coefficients.T,
  }
}
