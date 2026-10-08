/**
 * Wave optics: intensity distribution on the screen behind a single or double
 * slit, for monochromatic or polychromatic, point-like or extended sources.
 *
 * Geometry between the slit and the screen is described by a paraxial ray
 * matrix (A, B) so that free space and lens systems share one formulation
 * (Collins diffraction integral):
 *
 *   U(x) ∝ ∫ U₀(ξ) exp{ iπ/(λB) (A ξ² − 2 x ξ) } dξ
 *
 * With an incident wavefront of radius R this is ordinary Fresnel diffraction
 * at an effective distance L_e = B / M observed with magnification
 * M = A + B/R. In the far-field limit it reduces to the Fraunhofer pattern
 * with sin θ → x / B; for free space B is simply the slit–screen distance L.
 */
import { fresnelNumber, fresnelSlitsIntensity, singleSlitIntensity } from './diffraction'
import type { SlitAperture } from './diffraction'
import { idealDoubleSlitIntensity } from './interference'
import type { Rgb } from './spectrum'
import type { DiffractionModel } from './types'

export interface SpectralLine {
  wavelength: number
  /** Linear-sRGB contribution of this line at unit intensity. */
  rgb: Rgb
}

export interface SlitPatternParams {
  slitWidth: number
  /** Centre-to-centre separation; null for a single slit. */
  separation: number | null
  lines: readonly SpectralLine[]
  /** Ray-matrix elements from the slit plane to the screen. */
  A: number
  B: number
  /** True when only free space lies between slit and screen (enables exact sin θ). */
  freeSpace: boolean
  /** Radius of curvature of the wavefront illuminating the slit (Infinity = plane wave). */
  wavefrontRadius: number
  model: DiffractionModel
  /**
   * Width over which the pattern is smeared on the screen by the angular size
   * of an extended incoherent source (0 for a laser).
   */
  smearWidth: number
  /** Source output as a fraction of full power. */
  power: number
}

export interface PatternSamples {
  /** Linear RGB triples, length 3n. */
  rgb: Float32Array
  /** Relative intensity (1 = strongest point of the pattern at full power), length n. */
  intensity: Float32Array
}

export interface SlitPattern {
  /** Samples the pattern at positions u₀ + i·du (metres across the screen). */
  sample(start: number, step: number, count: number): PatternSamples
  /** Effective Fresnel-diffraction distance L_e and magnification M. */
  effectiveDistance: number
  transverseMagnification: number
}

/** Fresnel numbers below this are evaluated with the Fraunhofer limit even in Fresnel mode. */
const FRESNEL_FLOOR = 1e-4

export function slitApertures(slitWidth: number, separation: number | null): SlitAperture[] {
  if (separation === null) return [{ center: 0, width: slitWidth }]
  return [
    { center: -separation / 2, width: slitWidth },
    { center: separation / 2, width: slitWidth },
  ]
}

/** Half of the total transverse extent of the aperture. */
export function apertureHalfExtent(slitWidth: number, separation: number | null): number {
  return ((separation ?? 0) + slitWidth) / 2
}

export function buildSlitPattern(params: SlitPatternParams): SlitPattern {
  const { slitWidth, separation, lines, A, B, freeSpace, wavefrontRadius, model, smearWidth, power } = params
  const slits = slitApertures(slitWidth, separation)
  const halfExtent = apertureHalfExtent(slitWidth, separation)
  const magnificationM = A + (Number.isFinite(wavefrontRadius) ? B / wavefrontRadius : 0)
  const effectiveDistance = Math.abs(magnificationM) < 1e-12 ? Infinity : B / magnificationM
  const referenceWavelength = lines[Math.floor(lines.length / 2)].wavelength

  const fraunhofer = (x: number, wavelength: number): number => {
    const sinTheta = freeSpace ? x / Math.hypot(x, B) : x / B
    const envelope = singleSlitIntensity(slitWidth, wavelength, sinTheta)
    return separation === null ? envelope : envelope * idealDoubleSlitIntensity(separation, wavelength, sinTheta)
  }

  // Fresnel result normalised like the Fraunhofer one (central far-field peak = 1).
  const fresnel = (x: number, wavelength: number): number => {
    const distance = Math.max(Math.abs(effectiveDistance), 1e-9)
    const farFieldPeak = (slits.length * slitWidth) ** 2 / (wavelength * distance)
    return fresnelSlitsIntensity(x / magnificationM, slits, wavelength, distance) / farFieldPeak
  }

  const fresnelApplies = (wavelength: number): boolean =>
    model === 'fresnel' &&
    Number.isFinite(effectiveDistance) &&
    fresnelNumber(halfExtent, wavelength, effectiveDistance) > FRESNEL_FLOOR

  const single = (x: number, wavelength: number): number =>
    fresnelApplies(wavelength) ? fresnel(x, wavelength) : fraunhofer(x, wavelength)

  // Display gain: scale so the brightest point of the pattern is 1 at full
  // power. The Fraunhofer pattern already peaks at exactly 1 on the axis.
  let gain = 1
  if (fresnelApplies(referenceWavelength)) {
    const range = halfExtent * Math.abs(magnificationM) + (4 * referenceWavelength * Math.abs(B)) / slitWidth
    let peak = 0
    const steps = 600
    for (let i = 0; i <= steps; i++) {
      peak = Math.max(peak, fresnel((range * i) / steps, referenceWavelength))
    }
    if (peak > 0) gain = 1 / peak
  }

  // Normalise polychromatic light so the undiffracted colour has peak channel 1.
  // Each line carries the 1/λ scaling of the one-dimensional far-field peak.
  const weights = lines.map((line) => referenceWavelength / line.wavelength)
  const white = [0, 0, 0]
  let weightSum = 0
  lines.forEach((line, i) => {
    white[0] += line.rgb[0] * weights[i]
    white[1] += line.rgb[1] * weights[i]
    white[2] += line.rgb[2] * weights[i]
    weightSum += weights[i]
  })
  const colourNorm = 1 / Math.max(white[0], white[1], white[2], 1e-12)

  const sampleRaw = (start: number, step: number, count: number): PatternSamples => {
    const rgb = new Float32Array(count * 3)
    const intensity = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const x = start + i * step
      let r = 0
      let g = 0
      let b = 0
      let total = 0
      for (let k = 0; k < lines.length; k++) {
        const value = single(x, lines[k].wavelength) * weights[k]
        r += lines[k].rgb[0] * value
        g += lines[k].rgb[1] * value
        b += lines[k].rgb[2] * value
        total += value
      }
      const scale = gain * power
      rgb[3 * i] = r * colourNorm * scale
      rgb[3 * i + 1] = g * colourNorm * scale
      rgb[3 * i + 2] = b * colourNorm * scale
      intensity[i] = (total / weightSum) * scale
    }
    return { rgb, intensity }
  }

  const sample = (start: number, step: number, count: number): PatternSamples => {
    const window = Math.round(smearWidth / step)
    if (window < 2) return sampleRaw(start, step, count)
    // Incoherent sum over the source: every source point produces the same
    // pattern shifted sideways, so the result is a moving average.
    const before = Math.floor(window / 2)
    const total = count + window - 1
    const raw = sampleRaw(start - before * step, step, total)
    const rgb = new Float32Array(count * 3)
    const intensity = new Float32Array(count)
    const average = (source: Float32Array, target: Float32Array, stride: number, offset: number) => {
      let sum = 0
      for (let i = 0; i < window; i++) sum += source[i * stride + offset]
      for (let i = 0; i < count; i++) {
        target[i * stride + offset] = sum / window
        if (i + window < total) sum += source[(i + window) * stride + offset] - source[i * stride + offset]
      }
    }
    average(raw.rgb, rgb, 3, 0)
    average(raw.rgb, rgb, 3, 1)
    average(raw.rgb, rgb, 3, 2)
    average(raw.intensity, intensity, 1, 0)
    return { rgb, intensity }
  }

  return { sample, effectiveDistance, transverseMagnification: magnificationM }
}
