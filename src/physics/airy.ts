/**
 * Wave optics: Fraunhofer diffraction at a circular aperture (Airy pattern).
 *
 *   I(θ) = I₀ [2 J₁(x) / x]²,   x = π D sin θ / λ
 *
 * The first dark ring lies at x = 3.8317, i.e. sin θ = 1.22 λ / D.
 */

const SERIES_LIMIT = 12

/**
 * Bessel function of the first kind, order one. Power series for |x| ≤ 12,
 * Hankel asymptotic expansion beyond (absolute error < 1e-8).
 */
export function besselJ1(x: number): number {
  const ax = Math.abs(x)
  let value: number
  if (ax <= SERIES_LIMIT) {
    // J₁(x) = Σ (−1)ᵏ (x/2)²ᵏ⁺¹ / (k! (k+1)!)
    const half = ax / 2
    const square = half * half
    let term = half
    value = term
    for (let k = 1; k < 80; k++) {
      term *= -square / (k * (k + 1))
      value += term
      if (Math.abs(term) < 1e-17) break
    }
  } else {
    // J₁(x) ~ √(2/πx) [P cos χ − Q sin χ],  χ = x − 3π/4
    const inv = 1 / ax
    const inv2 = inv * inv
    const p = 1 + inv2 * (15 / 128 - inv2 * (14175 / 98304))
    const q = inv * (3 / 8 - inv2 * (315 / 3072 - inv2 * (1091475 / 3932160)))
    const chi = ax - 0.75 * Math.PI
    value = Math.sqrt(2 / (Math.PI * ax)) * (p * Math.cos(chi) - q * Math.sin(chi))
  }
  return x < 0 ? -value : value
}

/** First zero of J₁ divided by π: sin θ₁ = AIRY_FIRST_ZERO · λ / D ≈ 1.22 λ / D. */
export const AIRY_FIRST_ZERO = 3.8317059702075125 / Math.PI

/** 2 J₁(x)/x with the removable singularity handled. */
export function jinc(x: number): number {
  if (Math.abs(x) < 1e-6) return 1 - (x * x) / 8
  return (2 * besselJ1(x)) / x
}

/** Normalised Airy intensity I/I₀ as a function of sin θ. */
export function airyIntensity(diameter: number, wavelength: number, sinTheta: number): number {
  const value = jinc((Math.PI * diameter * sinTheta) / wavelength)
  return value * value
}

/** Angle of the first dark ring: sin θ = 1.22 λ / D. Null when it does not exist. */
export function airyFirstZeroAngle(diameter: number, wavelength: number): number | null {
  const sine = (AIRY_FIRST_ZERO * wavelength) / diameter
  if (sine > 1) return null
  return Math.asin(sine)
}

/** Radius of the first dark ring on a screen a distance L away (small angles): 1.22 λ L / D. */
export function airyDiscRadius(diameter: number, wavelength: number, distance: number): number {
  return (AIRY_FIRST_ZERO * wavelength * distance) / diameter
}

/** Aperture diameter from the measured diameter of the first dark ring: D = 2.44 λ L / D_ring. */
export function apertureFromDarkRing(ringDiameter: number, wavelength: number, distance: number): number {
  return (2 * AIRY_FIRST_ZERO * wavelength * distance) / ringDiameter
}
