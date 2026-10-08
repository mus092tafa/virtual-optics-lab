import { describe, expect, it } from 'vitest'
import { HENE_WAIST_RADIUS, HENE_WAVELENGTH, TUNGSTEN_TEMPERATURE } from '../constants'
import {
  centralMaximumWidth,
  classifyRegime,
  fresnelIntegrals,
  fresnelNumber,
  fresnelSlitsIntensity,
  singleSlitIntensity,
  singleSlitMinimumAngle,
  slitWidthFromCentralMaximum,
} from '../diffraction'
import { beamRadiusFromWaist, divergenceHalfAngle, propagateBeam, rayleighRange } from '../gaussianBeam'
import {
  brightFringePosition,
  doubleSlitIntensity,
  fringeSpacing,
  fringesInCentralMaximum,
  idealDoubleSlitIntensity,
  wavelengthFromFringeSpacing,
} from '../interference'
import { buildSlitPattern } from '../slitPattern'
import { blackbodyRgb, blackbodySpectrum, planckRadiance, wavelengthToRgb, wienPeakWavelength } from '../spectrum'
import { cm, mm, nm } from '../units'

const λ = HENE_WAVELENGTH

describe('single-slit Fraunhofer diffraction', () => {
  const a = mm(0.1)
  it('has unit intensity on axis and zeros at a sinθ = mλ', () => {
    expect(singleSlitIntensity(a, λ, 0)).toBe(1)
    for (const m of [1, 2, 3, -1]) expect(singleSlitIntensity(a, λ, (m * λ) / a)).toBeCloseTo(0, 20)
  })
  it('first secondary maximum is 4.72% of the central peak', () => {
    // Maximum of sinc² at β = 1.4303π
    expect(singleSlitIntensity(a, λ, (1.4303 * λ) / a)).toBeCloseTo(0.04718, 4)
  })
  it('reducing the slit width widens the central maximum', () => {
    const L = 1
    const widths = [mm(0.4), mm(0.2), mm(0.1), mm(0.05), mm(0.02)].map((w) => centralMaximumWidth(w, λ, L))
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1])
    // a = 0.1 mm, L = 1 m: W ≈ 2λL/a = 12.66 mm
    expect(centralMaximumWidth(mm(0.1), λ, L)).toBeCloseTo(mm(12.656), 5)
    expect(centralMaximumWidth(mm(0.05), λ, L) / centralMaximumWidth(mm(0.1), λ, L)).toBeCloseTo(2, 3)
  })
  it('increasing the wavelength widens the pattern', () => {
    expect(centralMaximumWidth(a, nm(632.8), 1)).toBeGreaterThan(centralMaximumWidth(a, nm(543.5), 1))
    expect(singleSlitMinimumAngle(a, nm(632.8))!).toBeGreaterThan(singleSlitMinimumAngle(a, nm(543.5))!)
  })
  it('the first minimum of the sampled intensity sits at the predicted position', () => {
    const L = 1.1
    const pattern = buildSlitPattern({
      slitWidth: a, separation: null, lines: [{ wavelength: λ, rgb: [1, 0, 0] }],
      A: 1, B: L, freeSpace: true, wavefrontRadius: Infinity, model: 'fraunhofer', smearWidth: 0, power: 1,
    })
    const step = mm(0.005)
    const { intensity } = pattern.sample(0, step, 3000)
    let i = 1
    while (!(intensity[i] < intensity[i - 1] && intensity[i] <= intensity[i + 1])) i++
    expect(2 * i * step).toBeCloseTo(centralMaximumWidth(a, λ, L), 4)
    expect(slitWidthFromCentralMaximum(2 * i * step, λ, L)).toBeCloseTo(a, 6)
  })
})

describe('double-slit interference', () => {
  const a = mm(0.04)
  const d = mm(0.25)
  it('ideal fringes follow cos²', () => {
    expect(idealDoubleSlitIntensity(d, λ, 0)).toBe(1)
    expect(idealDoubleSlitIntensity(d, λ, λ / d)).toBeCloseTo(1, 12)
    expect(idealDoubleSlitIntensity(d, λ, λ / (2 * d))).toBeCloseTo(0, 20)
    expect(idealDoubleSlitIntensity(d, λ, λ / (4 * d))).toBeCloseTo(0.5, 12)
  })
  it('increasing the slit separation decreases the fringe spacing', () => {
    const spacings = [mm(0.1), mm(0.25), mm(0.5), mm(1)].map((s) => fringeSpacing(s, λ, 1))
    for (let i = 1; i < spacings.length; i++) expect(spacings[i]).toBeLessThan(spacings[i - 1])
    expect(fringeSpacing(mm(0.25), λ, 1)).toBeCloseTo(mm(2.5312), 7)
  })
  it('increasing the wavelength increases the fringe spacing', () => {
    expect(fringeSpacing(d, nm(632.8), 1)).toBeGreaterThan(fringeSpacing(d, nm(543.5), 1))
    expect(wavelengthFromFringeSpacing(fringeSpacing(d, λ, 1.1), d, 1.1)).toBeCloseTo(λ, 15)
  })
  it('finite slits: fringes sit inside the single-slit envelope', () => {
    for (const s of [0, 0.001, 0.0033, 0.007]) {
      const combined = doubleSlitIntensity(a, d, λ, s)
      expect(combined).toBeCloseTo(singleSlitIntensity(a, λ, s) * idealDoubleSlitIntensity(d, λ, s), 15)
      expect(combined).toBeLessThanOrEqual(singleSlitIntensity(a, λ, s) + 1e-15)
    }
  })
  it('counts fringes in the central maximum and finds missing orders', () => {
    expect(fringesInCentralMaximum(mm(0.05), mm(0.25))).toBe(9) // d/a = 5: orders ±5 missing
    expect(fringesInCentralMaximum(mm(0.04), mm(0.25))).toBe(13) // d/a = 6.25
    expect(doubleSlitIntensity(mm(0.05), mm(0.25), λ, (5 * λ) / mm(0.25))).toBeCloseTo(0, 20)
  })
  it('measured spacing of sampled dark fringes equals λL/d', () => {
    const L = 1.1
    const pattern = buildSlitPattern({
      slitWidth: a, separation: d, lines: [{ wavelength: λ, rgb: [1, 0, 0] }],
      A: 1, B: L, freeSpace: true, wavefrontRadius: Infinity, model: 'fraunhofer', smearWidth: 0, power: 1,
    })
    const step = mm(0.002)
    const { intensity } = pattern.sample(0, step, 5000)
    // Dark fringes are exact zeros of cos², unaffected by the envelope.
    const minima: number[] = []
    for (let i = 1; i < 4999; i++) if (intensity[i] < intensity[i - 1] && intensity[i] <= intensity[i + 1]) minima.push(i * step)
    expect(minima[0]).toBeCloseTo(fringeSpacing(d, λ, L) / 2, 5)
    expect(minima[1] - minima[0]).toBeCloseTo(fringeSpacing(d, λ, L), 5)
    expect(minima[2] - minima[1]).toBeCloseTo(fringeSpacing(d, λ, L), 5)
    // Bright fringes of ideal slits sit at d sinθ = mλ.
    expect(brightFringePosition(1, d, λ, L)!).toBeCloseTo(fringeSpacing(d, λ, L), 6)
    expect(idealDoubleSlitIntensity(d, λ, Math.sin(Math.atan(brightFringePosition(2, d, λ, L)! / L)))).toBeCloseTo(1, 10)
  })
})

describe('Fraunhofer validity and Fresnel diffraction', () => {
  it('Fresnel integrals match tabulated values', () => {
    const table: [number, number, number][] = [
      [0.5, 0.4923442, 0.0647324],
      [1, 0.7798934, 0.4382591],
      [2, 0.4882534, 0.3434157],
      [3, 0.6057208, 0.4963130],
      [3.5, 0.5325724, 0.4152480],
      [5, 0.5636312, 0.4991914],
    ]
    for (const [x, c, s] of table) {
      const [C, S] = fresnelIntegrals(x) as number[]
      expect(C).toBeCloseTo(c, 5)
      expect(S).toBeCloseTo(s, 5)
      const [Cn, Sn] = fresnelIntegrals(-x) as number[]
      expect(Cn).toBeCloseTo(-c, 5)
      expect(Sn).toBeCloseTo(-s, 5)
    }
    const [C, S] = fresnelIntegrals(60) as number[]
    // Asymptotically C → ½ + sin(πx²/2)/(πx), S → ½ − cos(πx²/2)/(πx).
    expect(C).toBeCloseTo(0.5, 5)
    expect(S).toBeCloseTo(0.5 - 1 / (60 * Math.PI), 5)
  })
  it('classifies the regime by Fresnel number', () => {
    expect(classifyRegime(fresnelNumber(mm(0.05), λ, 1.1))).toBe('far-field')
    expect(classifyRegime(fresnelNumber(mm(0.25), λ, 0.05))).toBe('near-field')
    expect(classifyRegime(fresnelNumber(mm(0.25), λ, 0.3))).toBe('marginal')
  })
  it('Fresnel diffraction converges to the Fraunhofer formula in the far field', () => {
    const a = mm(0.1)
    const L = 2
    const peak = a * a / (λ * L)
    for (const x of [0, mm(3), mm(8), mm(12.656), mm(18)]) {
      const fresnel = fresnelSlitsIntensity(x, [{ center: 0, width: a }], λ, L) / peak
      expect(fresnel).toBeCloseTo(singleSlitIntensity(a, λ, x / L), 2)
    }
  })
  it('in the near field the slit casts a geometric shadow with unit intensity inside', () => {
    const a = mm(1)
    const L = mm(2)
    expect(fresnelSlitsIntensity(0, [{ center: 0, width: a }], λ, L)).toBeGreaterThan(0.7)
    expect(fresnelSlitsIntensity(0, [{ center: 0, width: a }], λ, L)).toBeLessThan(1.4)
    expect(fresnelSlitsIntensity(mm(1.5), [{ center: 0, width: a }], λ, L)).toBeLessThan(0.01)
    // Exactly at the geometric edge the intensity is one quarter.
    expect(fresnelSlitsIntensity(mm(0.5), [{ center: 0, width: a }], λ, L)).toBeCloseTo(0.25, 1)
  })
  it('the Fresnel model agrees with Fraunhofer for a far-field double slit', () => {
    const common = {
      slitWidth: mm(0.04), separation: mm(0.25), lines: [{ wavelength: λ, rgb: [1, 0, 0] as const }],
      A: 1, B: 3, freeSpace: true, wavefrontRadius: Infinity, smearWidth: 0, power: 1,
    }
    const far = buildSlitPattern({ ...common, model: 'fraunhofer' }).sample(0, mm(0.05), 400).intensity
    const near = buildSlitPattern({ ...common, model: 'fresnel' }).sample(0, mm(0.05), 400).intensity
    for (let i = 0; i < 400; i += 7) expect(near[i]).toBeCloseTo(far[i], 1)
  })
  it('a converging wavefront focused on the screen gives exact Fraunhofer conditions', () => {
    const pattern = buildSlitPattern({
      slitWidth: mm(0.5), separation: null, lines: [{ wavelength: λ, rgb: [1, 0, 0] }],
      A: 1, B: 0.2, freeSpace: true, wavefrontRadius: -0.2, model: 'fresnel', smearWidth: 0, power: 1,
    })
    expect(pattern.effectiveDistance).toBe(Infinity)
    const firstMinimum = (λ * 0.2) / mm(0.5)
    expect(pattern.sample(firstMinimum, 1, 1).intensity[0]).toBeCloseTo(0, 6)
  })
})

describe('extended and broadband sources', () => {
  const base = {
    slitWidth: mm(0.04), separation: mm(0.25), A: 1, B: 1, freeSpace: true,
    wavefrontRadius: Infinity, model: 'fraunhofer' as const, power: 1,
  }
  const visibility = (intensity: Float32Array) => {
    // Contrast between the central bright fringe and the first dark fringe.
    let min = Infinity
    for (let i = 0; i < intensity.length; i++) min = Math.min(min, intensity[i])
    return (intensity[0] - min) / (intensity[0] + min)
  }
  it('a large incoherent source washes out the fringes', () => {
    const lines = [{ wavelength: λ, rgb: [1, 0, 0] as const }]
    const spacing = fringeSpacing(base.separation, λ, 1)
    const n = Math.round(spacing / mm(0.01))
    const point = buildSlitPattern({ ...base, lines, smearWidth: 0 }).sample(0, mm(0.01), n).intensity
    const small = buildSlitPattern({ ...base, lines, smearWidth: spacing * 0.25 }).sample(0, mm(0.01), n).intensity
    const large = buildSlitPattern({ ...base, lines, smearWidth: spacing }).sample(0, mm(0.01), n).intensity
    expect(visibility(point)).toBeGreaterThan(0.99)
    expect(visibility(small)).toBeLessThan(visibility(point))
    expect(visibility(small)).toBeGreaterThan(0.8)
    expect(visibility(large)).toBeLessThan(0.05)
  })
  it('white light gives a white central fringe and coloured outer fringes', () => {
    const lines = blackbodySpectrum(TUNGSTEN_TEMPERATURE)
    const pattern = buildSlitPattern({ ...base, lines, smearWidth: 0 })
    const centre = pattern.sample(0, 1, 1).rgb
    // All wavelengths are in phase on the axis: the centre is warm white.
    expect(centre[0]).toBeCloseTo(1, 5)
    expect(centre[1]).toBeGreaterThan(0.4)
    expect(centre[1]).toBeGreaterThan(centre[2])
    // Where red (650 nm) has its first minimum blue-green still passes: hue shifts.
    const off = pattern.sample((nm(650) * 1) / (2 * base.separation), 1, 1).rgb
    // Red is removed there, so the fringe turns blue-green (red may even leave the sRGB gamut).
    expect(off[0]).toBeLessThan(off[2])
    expect(off[0]).toBeLessThan(off[1])
  })
  it('source power scales brightness without changing the pattern shape', () => {
    const lines = [{ wavelength: λ, rgb: [1, 0, 0] as const }]
    const full = buildSlitPattern({ ...base, lines, smearWidth: 0, power: 1 }).sample(0, mm(0.05), 200).intensity
    const half = buildSlitPattern({ ...base, lines, smearWidth: 0, power: 0.5 }).sample(0, mm(0.05), 200).intensity
    for (let i = 0; i < 200; i += 9) expect(half[i]).toBeCloseTo(full[i] / 2, 6)
  })
})

describe('He-Ne Gaussian beam', () => {
  it('has the divergence of a real laboratory He-Ne laser', () => {
    // Full angle ≈ 1 mrad for a 0.81 mm beam.
    expect(2 * divergenceHalfAngle(HENE_WAIST_RADIUS, λ)).toBeCloseTo(0.995e-3, 5)
    expect(rayleighRange(HENE_WAIST_RADIUS, λ)).toBeCloseTo(0.8143, 3)
  })
  it('free-space propagation matches w(z) = w₀√(1+(z/zR)²)', () => {
    const path = propagateBeam([], λ, HENE_WAIST_RADIUS, 0, 1.2)
    expect(path.radiusAtEnd).toBeCloseTo(beamRadiusFromWaist(HENE_WAIST_RADIUS, λ, 1.2), 12)
    expect(path.radiusAtEnd).toBeGreaterThan(HENE_WAIST_RADIUS)
  })
  it('a lens focuses the beam to a waist near the focal plane of size ≈ λf/(πw)', () => {
    const f = cm(10)
    const lensX = cm(35)
    const path = propagateBeam([{ x: lensX, focalLength: f, aperture: mm(40) }], λ, HENE_WAIST_RADIUS, 0, cm(80))
    const focus = path.waists[1]
    const wAtLens = beamRadiusFromWaist(HENE_WAIST_RADIUS, λ, lensX)
    // Gaussian focal shift: s' = f + (s − f) f² / ((s − f)² + zR²), slightly beyond f.
    const zR = rayleighRange(HENE_WAIST_RADIUS, λ)
    const expected = f + ((lensX - f) * f * f) / ((lensX - f) ** 2 + zR * zR)
    expect(focus.x - lensX).toBeCloseTo(expected, 9)
    expect(focus.x - lensX).toBeGreaterThan(f)
    expect(focus.x - lensX).toBeLessThan(f * 1.05)
    expect(focus.radius / ((λ * f) / (Math.PI * wAtLens))).toBeCloseTo(1, 1)
    // Beyond the focus the beam expands again.
    expect(path.radiusAtEnd).toBeGreaterThan(focus.radius * 10)
  })
  it('a 1:3 Keplerian telescope expands the beam about threefold', () => {
    const lenses = [
      { x: cm(20), focalLength: cm(5), aperture: mm(40) },
      { x: cm(40), focalLength: cm(15), aperture: mm(40) },
    ]
    const before = propagateBeam([], λ, HENE_WAIST_RADIUS, 0, cm(20)).radiusAtEnd
    const after = propagateBeam(lenses, λ, HENE_WAIST_RADIUS, 0, cm(41)).radiusAtEnd
    expect(after / before).toBeGreaterThan(2.8)
    expect(after / before).toBeLessThan(3.2)
  })
})

describe('spectrum and colour', () => {
  it('He-Ne 632.8 nm renders as saturated red, 543.5 nm as green', () => {
    const red = wavelengthToRgb(nm(632.8))
    expect(red[0]).toBe(1)
    expect(red[1]).toBeLessThan(0.05)
    expect(red[2]).toBeLessThan(0.05)
    const green = wavelengthToRgb(nm(543.5))
    expect(green[1]).toBe(1)
    expect(green[2]).toBeLessThan(0.2)
  })
  it('Planck spectrum of tungsten rises towards the red and peaks in the infrared', () => {
    expect(planckRadiance(nm(700), TUNGSTEN_TEMPERATURE)).toBeGreaterThan(planckRadiance(nm(450), TUNGSTEN_TEMPERATURE))
    expect(wienPeakWavelength(TUNGSTEN_TEMPERATURE)).toBeCloseTo(nm(999.2), 9)
    const lamp = blackbodyRgb(TUNGSTEN_TEMPERATURE)
    expect(lamp[0]).toBe(1)
    expect(lamp[0]).toBeGreaterThan(lamp[1])
    expect(lamp[1]).toBeGreaterThan(lamp[2])
  })
})
