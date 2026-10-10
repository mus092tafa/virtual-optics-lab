/**
 * Wave optics: transmission diffraction grating at normal incidence.
 *
 *   grating equation:   d sin θ_m = m λ            (d: period, m: order)
 *   amplitude grating:  η_m = (a/d)² [sin(π m a/d) / (π m a/d)]²
 *
 * The order angles are exact; no small-angle approximation is made, because a
 * grating deflects light by tens of degrees.
 *
 * Laser light: when the beam covers many lines, the field behind the grating
 * is a sum of copies of the incident Gaussian beam, one per order, each
 * deflected by θ_m. In the plane of dispersion the copy has beam parameter
 * q' = q cos²θ_m (its width is foreshortened by cos θ_m) and travels
 * L / cos θ_m to a screen a distance L behind the grating, where its
 * footprint is stretched by 1 / cos θ_m.
 *
 * White light from an extended source: each wavelength and order projects
 * the ruled aperture onto the screen (see `buildGratingSpectrum`).
 */
import { sinc } from './diffraction'
import { beamRadius, propagateQ } from './gaussianBeam'
import type { Complex } from './gaussianBeam'
import type { PatternSamples, SlitPattern, SpectralLine } from './slitPattern'

/** Grating period d from the line density (lines per metre). */
export function gratingPeriod(lineDensity: number): number {
  return 1 / lineDensity
}

/** Angle of order m: d sin θ = m λ. Null when the order does not propagate. */
export function orderAngle(order: number, period: number, wavelength: number): number | null {
  const sine = (order * wavelength) / period
  if (Math.abs(sine) >= 1) return null
  return Math.asin(sine)
}

/** Highest order that propagates: the largest m with m λ / d < 1. */
export function highestOrder(period: number, wavelength: number): number {
  const ratio = period / wavelength
  const whole = Math.floor(ratio)
  return ratio - whole < 1e-12 ? whole - 1 : whole
}

/** Screen position of order m a distance L behind the grating: y = L tan θ_m. */
export function orderPosition(order: number, period: number, wavelength: number, distance: number): number | null {
  const angle = orderAngle(order, period, wavelength)
  return angle === null ? null : distance * Math.tan(angle)
}

/** Fraction of the incident power in order m of an amplitude grating with open fraction a/d. */
export function orderEfficiency(order: number, openFraction: number): number {
  const envelope = sinc(Math.PI * order * openFraction)
  return openFraction * openFraction * envelope * envelope
}

/** Wavelength from the measured position y of order m: λ = d sin(tan⁻¹(y/L)) / m. */
export function wavelengthFromOrder(position: number, distance: number, order: number, period: number): number {
  return (period * Math.sin(Math.atan2(Math.abs(position), distance))) / Math.abs(order)
}

/** Angular dispersion dθ/dλ = m / (d cos θ) of order m. */
export function angularDispersion(order: number, period: number, wavelength: number): number | null {
  const angle = orderAngle(order, period, wavelength)
  return angle === null ? null : order / (period * Math.cos(angle))
}

export interface OrderSpot {
  order: number
  angle: number
  /** Centre of the spot on the screen, along the direction of dispersion. */
  position: number
  /** 1/e² radii of the footprint on the screen, along and across the dispersion. */
  radiusAlong: number
  radiusAcross: number
  /** Fraction of the incident power in this order. */
  efficiency: number
  /** Peak irradiance relative to the brightest order. */
  level: number
}

export interface LaserOrdersParams {
  period: number
  wavelength: number
  openFraction: number
  /** Beam parameter of the incident beam at the grating. */
  q: Complex
  /** Grating-to-screen distance. */
  distance: number
  maxOrder: number
}

/** The diffraction orders of a Gaussian laser beam as spots on a screen. */
export function laserOrderSpots(params: LaserOrdersParams): OrderSpot[] {
  const { period, wavelength, openFraction, q, distance, maxOrder } = params
  const limit = Math.min(maxOrder, highestOrder(period, wavelength))
  const spots: OrderSpot[] = []
  for (let order = -limit; order <= limit; order++) {
    const angle = orderAngle(order, period, wavelength)
    if (angle === null) continue
    const cosine = Math.cos(angle)
    const path = distance / cosine
    const inPlane = propagateQ({ re: q.re * cosine * cosine, im: q.im * cosine * cosine }, path)
    const radiusAlong = beamRadius(inPlane, wavelength) / cosine
    const radiusAcross = beamRadius(propagateQ(q, path), wavelength)
    const efficiency = orderEfficiency(order, openFraction)
    spots.push({
      order,
      angle,
      position: distance * Math.tan(angle),
      radiusAlong,
      radiusAcross,
      efficiency,
      // Peak irradiance of a Gaussian spot: 2P / (π w_a w_b).
      level: efficiency / (radiusAlong * radiusAcross),
    })
  }
  const peak = Math.max(...spots.map((spot) => spot.level))
  for (const spot of spots) spot.level /= peak
  return spots
}

/**
 * Unit-area trapezoid: the convolution of two boxes of full widths a and b,
 * evaluated at offset x from its centre.
 */
export function trapezoid(x: number, a: number, b: number): number {
  const wide = Math.max(a, b)
  const narrow = Math.min(a, b)
  if (wide <= 0) return 0
  const offset = Math.abs(x)
  const plateau = (wide - narrow) / 2
  const base = (wide + narrow) / 2
  if (offset >= base) return 0
  if (offset <= plateau) return 1 / wide
  return (base - offset) / (narrow * wide)
}

export interface GratingSpectrumParams {
  period: number
  openFraction: number
  lines: readonly SpectralLine[]
  /** Grating-to-screen distance (free space). */
  distance: number
  /** Open width of the ruled area, across the lines. */
  aperture: number
  /** Aperture that defines unit brightness (the full ruled width). */
  referenceAperture: number
  /** Radius of curvature of the wavefront at the grating (Infinity: collimated). */
  wavefrontRadius: number
  /** Ray-matrix B element from the source to the grating. */
  sourceB: number
  /** Diameter of the incoherent source. */
  sourceSize: number
  /** Source output as a fraction of full power. */
  power: number
  maxOrder: number
}

interface Patch {
  centre: number
  a: number
  b: number
  weight: number
  rgb: readonly [number, number, number]
}

/**
 * Light of an extended, broadband source behind a grating.
 *
 * A ray from source point s through aperture point ξ arrives with slope
 * α = ξ/R − s/B and leaves order m with sin θ = sin α + m λ/d. It lands at
 * ξ + L tan θ, so one wavelength in one order fills a patch that is the
 * convolution of two boxes:
 *
 *   aperture:  W · |1 + (L/R) sec³θ|        source:  s · (L/|B|) sec³θ
 *
 * The patches of all wavelengths and orders add in intensity. Brightness is
 * relative to the centre of the zeroth order with the full ruled width open.
 */
export function buildGratingSpectrum(params: GratingSpectrumParams): SlitPattern {
  const { period, openFraction, lines, distance, aperture, referenceAperture, wavefrontRadius, sourceB, sourceSize, power, maxOrder } = params
  const curvature = Number.isFinite(wavefrontRadius) ? distance / wavefrontRadius : 0
  const sourceScale = distance / Math.max(Math.abs(sourceB), 1e-6)
  const widths = (width: number, cosine: number) => {
    const sec3 = 1 / (cosine * cosine * cosine)
    return { a: width * Math.abs(1 + curvature * sec3), b: sourceSize * sourceScale * sec3 }
  }

  const patches: Patch[] = []
  const zeroEfficiency = orderEfficiency(0, openFraction)
  for (const line of lines) {
    const limit = Math.min(maxOrder, highestOrder(period, line.wavelength))
    for (let order = -limit; order <= limit; order++) {
      const angle = orderAngle(order, period, line.wavelength)
      if (angle === null) continue
      const efficiency = orderEfficiency(order, openFraction)
      if (efficiency < 1e-5 * zeroEfficiency) continue
      const { a, b } = widths(aperture, Math.cos(angle))
      // Throughput is proportional to the open width and the source size.
      patches.push({ centre: distance * Math.tan(angle), a, b, weight: efficiency * aperture * sourceSize, rgb: line.rgb })
    }
  }
  const reference = widths(referenceAperture, 1)
  const unit = zeroEfficiency * referenceAperture * sourceSize * trapezoid(0, reference.a, reference.b)
  const scale = unit > 0 ? power / unit : 0

  const sample = (start: number, step: number, count: number): PatternSamples => {
    const rgb = new Float32Array(count * 3)
    const intensity = new Float32Array(count)
    for (const patch of patches) {
      const half = (patch.a + patch.b) / 2
      const first = Math.max(0, Math.ceil((patch.centre - half - start) / step))
      const last = Math.min(count - 1, Math.floor((patch.centre + half - start) / step))
      for (let i = first; i <= last; i++) {
        const value = patch.weight * trapezoid(start + i * step - patch.centre, patch.a, patch.b) * scale
        rgb[3 * i] += patch.rgb[0] * value
        rgb[3 * i + 1] += patch.rgb[1] * value
        rgb[3 * i + 2] += patch.rgb[2] * value
        intensity[i] += value / lines.length
      }
    }
    return { rgb, intensity }
  }

  return { sample, effectiveDistance: distance, transverseMagnification: 1 + curvature }
}
