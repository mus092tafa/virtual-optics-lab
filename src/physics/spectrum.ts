/**
 * Radiometry and colorimetry: turns physical spectra into display colours.
 *
 *  - Planck's law for the tungsten filament spectrum
 *  - CIE 1931 colour-matching functions (analytic multi-lobe fit of
 *    Wyman, Sloan & Shirley, JCGT 2013)
 *  - CIE XYZ -> linear sRGB
 */
import { BOLTZMANN_CONSTANT, PLANCK_CONSTANT, SPEED_OF_LIGHT, VISIBLE_MAX, VISIBLE_MIN } from './constants'
import { fromMeters } from './units'

export type Rgb = readonly [r: number, g: number, b: number]

/** Black-body spectral radiance B_λ(T), W·sr⁻¹·m⁻³. */
export function planckRadiance(wavelength: number, temperature: number): number {
  const numerator = 2 * PLANCK_CONSTANT * SPEED_OF_LIGHT * SPEED_OF_LIGHT
  const exponent = (PLANCK_CONSTANT * SPEED_OF_LIGHT) / (wavelength * BOLTZMANN_CONSTANT * temperature)
  return numerator / (wavelength ** 5 * Math.expm1(exponent))
}

/** Wien displacement law: wavelength of peak black-body emission. */
export function wienPeakWavelength(temperature: number): number {
  return 2.897771955e-3 / temperature
}

function lobe(wavelengthNm: number, mean: number, sigmaLow: number, sigmaHigh: number): number {
  const t = (wavelengthNm - mean) / (wavelengthNm < mean ? sigmaLow : sigmaHigh)
  return Math.exp(-0.5 * t * t)
}

/** CIE 1931 2° colour-matching functions x̄, ȳ, z̄. */
export function colorMatching(wavelength: number): [number, number, number] {
  const l = fromMeters(wavelength, 'nm')
  const x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2)
  const y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1)
  const z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8)
  return [x, y, z]
}

/** CIE XYZ (D65) to linear sRGB. Components may fall outside [0, 1]. */
export function xyzToLinearRgb(x: number, y: number, z: number): [number, number, number] {
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ]
}

function normalizeRgb(rgb: readonly number[]): Rgb {
  const r = Math.max(0, rgb[0])
  const g = Math.max(0, rgb[1])
  const b = Math.max(0, rgb[2])
  const peak = Math.max(r, g, b)
  if (peak <= 0) return [0, 0, 0]
  return [r / peak, g / peak, b / peak]
}

/** Display colour of monochromatic light, clipped to the sRGB gamut, peak channel = 1. */
export function wavelengthToRgb(wavelength: number): Rgb {
  const [x, y, z] = colorMatching(wavelength)
  return normalizeRgb(xyzToLinearRgb(x, y, z))
}

export interface SpectralSample {
  wavelength: number
  /**
   * Linear-sRGB contribution of this spectral band (radiance × colour
   * matching × band width). Individual bands may have negative components;
   * only their sum is a physical colour.
   */
  rgb: Rgb
}

/** Samples the visible part of a black-body spectrum as RGB-weighted bands. */
export function blackbodySpectrum(temperature: number, bands = 35): SpectralSample[] {
  const step = (VISIBLE_MAX - VISIBLE_MIN) / bands
  const samples: SpectralSample[] = []
  for (let i = 0; i < bands; i++) {
    const wavelength = VISIBLE_MIN + (i + 0.5) * step
    const radiance = planckRadiance(wavelength, temperature)
    const [x, y, z] = colorMatching(wavelength)
    const rgb = xyzToLinearRgb(radiance * x, radiance * y, radiance * z)
    samples.push({ wavelength, rgb: [rgb[0], rgb[1], rgb[2]] })
  }
  // Scale so that the summed colour has a peak channel of 1.
  const total = [0, 0, 0]
  for (const sample of samples) {
    total[0] += sample.rgb[0]
    total[1] += sample.rgb[1]
    total[2] += sample.rgb[2]
  }
  const peak = Math.max(total[0], total[1], total[2])
  return samples.map((sample) => ({
    wavelength: sample.wavelength,
    rgb: [sample.rgb[0] / peak, sample.rgb[1] / peak, sample.rgb[2] / peak],
  }))
}

/** Display colour of a black-body radiator, peak channel = 1. */
export function blackbodyRgb(temperature: number): Rgb {
  const total = [0, 0, 0]
  for (const sample of blackbodySpectrum(temperature)) {
    total[0] += sample.rgb[0]
    total[1] += sample.rgb[1]
    total[2] += sample.rgb[2]
  }
  return normalizeRgb(total)
}
