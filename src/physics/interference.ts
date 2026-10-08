/**
 * Wave optics: two-slit (Young) interference.
 *
 *   ideal slits:        I(θ) ∝ cos² δ,                 δ = π d sin θ / λ
 *   finite slit width:  I(θ) = I₀ [sin β / β]² cos² δ,  β = π a sin θ / λ
 */
import { singleSlitIntensity } from './diffraction'

/** δ = π d sin θ / λ. */
export function interferencePhase(separation: number, wavelength: number, sinTheta: number): number {
  return (Math.PI * separation * sinTheta) / wavelength
}

/** Ideal two-slit interference, normalised to 1 at the central fringe. */
export function idealDoubleSlitIntensity(separation: number, wavelength: number, sinTheta: number): number {
  const cosine = Math.cos(interferencePhase(separation, wavelength, sinTheta))
  return cosine * cosine
}

/** Interference fringes modulated by the single-slit diffraction envelope. */
export function doubleSlitIntensity(
  slitWidth: number,
  separation: number,
  wavelength: number,
  sinTheta: number,
): number {
  return (
    singleSlitIntensity(slitWidth, wavelength, sinTheta) *
    idealDoubleSlitIntensity(separation, wavelength, sinTheta)
  )
}

/** Small-angle spacing between adjacent bright fringes on the screen: Δy = λ L / d. */
export function fringeSpacing(separation: number, wavelength: number, distance: number): number {
  return (wavelength * distance) / separation
}

/** Angular fringe spacing Δθ ≈ λ / d. */
export function fringeAngularSpacing(separation: number, wavelength: number): number {
  return wavelength / separation
}

/** Exact screen position of the m-th bright fringe: d sin θ = m λ. Null if the order does not exist. */
export function brightFringePosition(
  order: number,
  separation: number,
  wavelength: number,
  distance: number,
): number | null {
  const sine = (order * wavelength) / separation
  if (Math.abs(sine) >= 1) return null
  return distance * Math.tan(Math.asin(sine))
}

/** Wavelength recovered from a measured fringe spacing (small angles). */
export function wavelengthFromFringeSpacing(spacing: number, separation: number, distance: number): number {
  return (spacing * separation) / distance
}

/**
 * Number of bright interference fringes inside the central diffraction
 * maximum. Orders with |m| < d/a are visible; when d/a is an integer the
 * orders ±d/a coincide with the envelope minima and are missing.
 */
export function fringesInCentralMaximum(slitWidth: number, separation: number): number {
  const ratio = separation / slitWidth
  const highest = Math.abs(ratio - Math.round(ratio)) < 1e-9 ? Math.round(ratio) - 1 : Math.floor(ratio)
  return 2 * Math.max(0, highest) + 1
}
