/**
 * Exact tracing of meridional rays through surfaces that are conicoids of
 * revolution: no small-angle approximation, Snell's law at every surface.
 *
 * A surface with vertex at z₀, vertex curvature c and asphericity Q is
 *   c (y² + (1 + Q) s²) − 2 s = 0,  s = z − z₀
 * (Q = 0 a sphere, −1 < Q < 0 a prolate ellipsoid, Q = −1 a paraboloid).
 * See docs/PHYSICS.md, "Spherical aberration of the eye".
 */

export interface ConicSurface {
  /** Position of the vertex on the axis. */
  vertex: number
  /** 1/r at the vertex; positive when the centre of curvature lies behind the surface. */
  curvature: number
  asphericity: number
  indexBefore: number
  indexAfter: number
}

/** A ray in the meridional plane: a point and a unit direction with dz > 0. */
export interface MeridionalRay {
  z: number
  y: number
  dz: number
  dy: number
}

/** A ray through the point (z, y) with the slope dy/dz. */
export function rayFrom(z: number, y: number, slope: number): MeridionalRay {
  const length = Math.hypot(1, slope)
  return { z, y, dz: 1 / length, dy: slope / length }
}

/** The ray moved on to the plane z. */
export function rayAt(ray: MeridionalRay, z: number): MeridionalRay {
  const t = (z - ray.z) / ray.dz
  return { ...ray, z, y: ray.y + t * ray.dy }
}

/** Where the ray crosses the axis; null when it runs parallel to it. */
export function axisCrossing(ray: MeridionalRay): number | null {
  return ray.dy === 0 ? null : ray.z - (ray.y * ray.dz) / ray.dy
}

/**
 * The ray refracted at a surface, starting from its point of incidence.
 * Null when the ray misses the surface or is totally reflected.
 */
export function refract(ray: MeridionalRay, surface: ConicSurface): MeridionalRay | null {
  const c = surface.curvature
  const shape = 1 + surface.asphericity
  const s0 = ray.z - surface.vertex
  // Along the ray the surface equation is a t² + b t + k = 0.
  const a = c * (ray.dy * ray.dy + shape * ray.dz * ray.dz)
  const b = 2 * c * (ray.y * ray.dy + shape * s0 * ray.dz) - 2 * ray.dz
  const k = c * (ray.y * ray.y + shape * s0 * s0) - 2 * s0
  const discriminant = b * b - 4 * a * k
  if (discriminant < 0) return null
  // The root that tends to the vertex plane as the curvature vanishes.
  const t = (2 * k) / (-b + Math.sqrt(discriminant))
  const z = ray.z + t * ray.dz
  const y = ray.y + t * ray.dy
  // Normal from the gradient of the surface equation, turned against the ray.
  let nz = 2 * c * shape * (z - surface.vertex) - 2
  let ny = 2 * c * y
  const length = Math.hypot(nz, ny)
  nz /= length
  ny /= length
  if (nz * ray.dz + ny * ray.dy > 0) {
    nz = -nz
    ny = -ny
  }
  // Snell's law in vector form: d′ = μ d + (μ cos i − √(1 − μ² sin² i)) n, μ = n/n′.
  const ratio = surface.indexBefore / surface.indexAfter
  const cosIncidence = -(nz * ray.dz + ny * ray.dy)
  const sinSquared = ratio * ratio * (1 - cosIncidence * cosIncidence)
  if (sinSquared > 1) return null
  const along = ratio * cosIncidence - Math.sqrt(1 - sinSquared)
  return { z, y, dz: ratio * ray.dz + along * nz, dy: ratio * ray.dy + along * ny }
}

/** The ray after every surface in turn, with its point on each; null when it is lost on the way. */
export function traceSurfaces(ray: MeridionalRay, surfaces: readonly ConicSurface[]): { ray: MeridionalRay; points: MeridionalRay[] } | null {
  const points: MeridionalRay[] = []
  let current = ray
  for (const surface of surfaces) {
    const next = refract(current, surface)
    // A ray that would meet a surface in front of the one before has passed outside the edge of the lens.
    if (!next || next.z < current.z - 1e-12 || next.dz <= 0) return null
    points.push(next)
    current = next
  }
  return { ray: current, points }
}

/** The x in [low, high] at which f changes sign, by bisection; f(low) and f(high) must differ in sign. */
export function bisect(f: (x: number) => number, low: number, high: number, steps = 60): number {
  let fLow = f(low)
  for (let i = 0; i < steps; i++) {
    const middle = (low + high) / 2
    const fMiddle = f(middle)
    if (fMiddle > 0 === fLow > 0) {
      low = middle
      fLow = fMiddle
    } else {
      high = middle
    }
  }
  return (low + high) / 2
}
