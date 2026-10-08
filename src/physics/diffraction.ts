/**
 * Wave optics: diffraction by slits.
 *
 * Fraunhofer (far-field) single slit:
 *   I(θ) = I₀ [sin β / β]²,   β = π a sin θ / λ
 *
 * Fresnel (near-field) diffraction is provided through the Fresnel integrals
 * so that configurations outside the far-field limit can be evaluated without
 * pretending the Fraunhofer formula still holds.
 */

/** sin(x)/x with the removable singularity handled. */
export function sinc(x: number): number {
  if (Math.abs(x) < 1e-8) return 1 - (x * x) / 6
  return Math.sin(x) / x
}

/** β = π a sin θ / λ. */
export function slitPhase(slitWidth: number, wavelength: number, sinTheta: number): number {
  return (Math.PI * slitWidth * sinTheta) / wavelength
}

/** Normalised Fraunhofer single-slit intensity I/I₀ as a function of sin θ. */
export function singleSlitIntensity(slitWidth: number, wavelength: number, sinTheta: number): number {
  const value = sinc(slitPhase(slitWidth, wavelength, sinTheta))
  return value * value
}

/** Angle of the m-th diffraction minimum: a sin θ = m λ. Null when it does not exist. */
export function singleSlitMinimumAngle(slitWidth: number, wavelength: number, order = 1): number | null {
  const sine = (order * wavelength) / slitWidth
  if (Math.abs(sine) > 1) return null
  return Math.asin(sine)
}

/**
 * Full width of the central maximum (between the two first minima) on a
 * screen a distance L from the slit: W = 2 L tan θ₁ ≈ 2 λ L / a.
 */
export function centralMaximumWidth(slitWidth: number, wavelength: number, distance: number): number {
  const angle = singleSlitMinimumAngle(slitWidth, wavelength, 1)
  if (angle === null) return Infinity
  return 2 * distance * Math.tan(angle)
}

/** Slit width recovered from a measured central-maximum width (small angles). */
export function slitWidthFromCentralMaximum(width: number, wavelength: number, distance: number): number {
  return (2 * wavelength * distance) / width
}

/**
 * Fresnel number N_F = r² / (λ L) for an aperture of half-extent r observed
 * at an effective distance L. Fraunhofer diffraction requires N_F ≪ 1.
 */
export function fresnelNumber(halfExtent: number, wavelength: number, distance: number): number {
  return (halfExtent * halfExtent) / (wavelength * Math.abs(distance))
}

export type FieldRegime = 'far-field' | 'marginal' | 'near-field'

export const FAR_FIELD_LIMIT = 0.1
export const NEAR_FIELD_LIMIT = 1

export function classifyRegime(fresnelNum: number): FieldRegime {
  if (fresnelNum < FAR_FIELD_LIMIT) return 'far-field'
  if (fresnelNum < NEAR_FIELD_LIMIT) return 'marginal'
  return 'near-field'
}

const SERIES_LIMIT = 3

/**
 * Fresnel integrals
 *   C(x) = ∫₀ˣ cos(π t²/2) dt,   S(x) = ∫₀ˣ sin(π t²/2) dt
 * written into `out` as [C, S]. Power series for |x| ≤ 3, asymptotic
 * expansion of the auxiliary functions f, g beyond (absolute error < 1e-6).
 */
export function fresnelIntegrals(x: number, out: Float64Array | number[] = [0, 0]): Float64Array | number[] {
  const ax = Math.abs(x)
  let c: number
  let s: number
  if (ax <= SERIES_LIMIT) {
    const half = Math.PI / 2
    const x2 = ax * ax
    const x4 = x2 * x2
    // C = Σ (−1)ⁿ (π/2)²ⁿ x⁴ⁿ⁺¹ / ((2n)! (4n+1))
    // S = Σ (−1)ⁿ (π/2)²ⁿ⁺¹ x⁴ⁿ⁺³ / ((2n+1)! (4n+3))
    let termC = ax
    let termS = half * ax * x2
    c = termC
    s = termS / 3
    for (let n = 1; n < 80; n++) {
      termC *= (-half * half * x4) / ((2 * n - 1) * (2 * n))
      termS *= (-half * half * x4) / ((2 * n) * (2 * n + 1))
      const dc = termC / (4 * n + 1)
      const ds = termS / (4 * n + 3)
      c += dc
      s += ds
      if (Math.abs(dc) < 1e-17 && Math.abs(ds) < 1e-17) break
    }
  } else {
    const t = Math.PI * ax * ax
    const inv2 = 1 / (t * t)
    // f ~ (1/πx) Σ (−1)ᵐ (4m−1)!! / (πx²)²ᵐ,  g ~ (1/π²x³) Σ (−1)ᵐ (4m+1)!! / (πx²)²ᵐ
    let termF = 1
    let termG = 1
    let f = 1
    let g = 1
    for (let m = 1; m < 12; m++) {
      const nextF = -termF * (4 * m - 3) * (4 * m - 1) * inv2
      const nextG = -termG * (4 * m - 1) * (4 * m + 1) * inv2
      if (Math.abs(nextF) > Math.abs(termF)) break
      termF = nextF
      termG = nextG
      f += termF
      g += termG
    }
    f /= Math.PI * ax
    g /= Math.PI * Math.PI * ax * ax * ax
    const phase = t / 2
    const sin = Math.sin(phase)
    const cos = Math.cos(phase)
    c = 0.5 + f * sin - g * cos
    s = 0.5 - f * cos - g * sin
  }
  out[0] = x < 0 ? -c : c
  out[1] = x < 0 ? -s : s
  return out
}

export interface SlitAperture {
  /** Centre of the slit, measured across the beam. */
  center: number
  width: number
}

const scratchA = new Float64Array(2)
const scratchB = new Float64Array(2)

/**
 * Fresnel diffraction of a unit-intensity plane wave by a set of parallel
 * slits, observed a distance L behind them at transverse position x.
 * Returns the intensity relative to the unobstructed wave:
 *   I = ½ |Σ_slits [F(u₂) − F(u₁)]|²,   u = √(2/λL) (ξ − x),  F = C + iS
 */
export function fresnelSlitsIntensity(
  x: number,
  slits: readonly SlitAperture[],
  wavelength: number,
  distance: number,
): number {
  const scale = Math.sqrt(2 / (wavelength * distance))
  let re = 0
  let im = 0
  for (const slit of slits) {
    fresnelIntegrals(scale * (slit.center - slit.width / 2 - x), scratchA)
    fresnelIntegrals(scale * (slit.center + slit.width / 2 - x), scratchB)
    re += scratchB[0] - scratchA[0]
    im += scratchB[1] - scratchA[1]
  }
  return 0.5 * (re * re + im * im)
}
