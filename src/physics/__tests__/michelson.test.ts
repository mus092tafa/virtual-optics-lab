import { describe, expect, it } from 'vitest'
import { HENE_WAIST_RADIUS, HENE_WAVELENGTH } from '../constants'
import { displacementPerFringe, ringOrder, solveMichelson, wavelengthFromFringeCount } from '../michelson'
import type { MichelsonSetup } from '../michelson'
import { cm, mm, nm, um } from '../units'

const λ = HENE_WAVELENGTH
const base: MichelsonSetup = {
  wavelength: λ,
  waistRadius: HENE_WAIST_RADIUS,
  laserToLens: cm(10),
  expanderFocalLength: cm(2),
  lensToSplitter: cm(10),
  armLength: cm(15),
  mirrorDisplacement: 0,
  tiltX: 0,
  tiltY: 0,
  splitterToScreen: cm(25),
}
const solve = (patch: Partial<MichelsonSetup>) => solveMichelson({ ...base, ...patch })

describe('Michelson interferometer', () => {
  it('equal arms and aligned mirrors: the field is uniformly dark (π phase at the splitter)', () => {
    const s = solve({})
    expect(s.pathDifference).toBe(0)
    expect(s.centreIntensity).toBeCloseTo(0, 12)
    expect(s.intensity(mm(5), mm(-3))).toBeCloseTo(0, 12)
  })
  it('moving the mirror by λ/4 turns dark into bright; by λ/2 back to dark', () => {
    expect(solve({ mirrorDisplacement: λ / 4 }).centreIntensity).toBeCloseTo(1, 4)
    expect(solve({ mirrorDisplacement: λ / 2 }).centreIntensity).toBeCloseTo(0, 6)
    expect(displacementPerFringe(λ)).toBeCloseTo(nm(316.4), 12)
  })
  it('the centre intensity follows sin²(2πd/λ)', () => {
    for (const d of [nm(40), nm(100), nm(200), nm(555)]) {
      expect(solve({ mirrorDisplacement: d }).centreIntensity).toBeCloseTo(Math.sin((2 * Math.PI * d) / λ) ** 2, 4)
    }
  })
  it('the fringe count is N = 2Δd/λ, so λ = 2Δd/N', () => {
    const start = solve({ mirrorDisplacement: mm(1) })
    const end = solve({ mirrorDisplacement: mm(1) + um(10) })
    const fringes = end.centreOrder - start.centreOrder
    expect(fringes).toBeCloseTo((2 * um(10)) / λ, 3) // 31.6 fringes
    expect(wavelengthFromFringeCount(um(10), fringes)).toBeCloseTo(λ, 11)
    // Counting bright maxima at the centre while scanning gives the same number.
    let maxima = 0
    let previous = start.centreIntensity
    let rising = false
    for (let i = 1; i <= 4000; i++) {
      const value = solve({ mirrorDisplacement: mm(1) + (um(10) * i) / 4000 }).centreIntensity
      if (value < previous && rising) maxima++
      rising = value > previous
      previous = value
    }
    // 31.6 fringes pass: 31 or 32 maxima depending on the starting phase.
    expect(maxima).toBeGreaterThanOrEqual(Math.floor(fringes))
    expect(maxima).toBeLessThanOrEqual(Math.ceil(fringes))
  })
  it('a longer wavelength gives fewer fringes for the same mirror travel', () => {
    const count = (wavelength: number) =>
      solve({ wavelength, mirrorDisplacement: um(20) }).centreOrder - solve({ wavelength, mirrorDisplacement: 0 }).centreOrder
    expect(count(nm(632.8))).toBeLessThan(count(nm(543.5)))
  })
  it('aligned mirrors with unequal arms give circular fringes obeying 2d cosθ = mλ', () => {
    const d = mm(1)
    const s = solve({ mirrorDisplacement: d })
    // Circular symmetry.
    expect(s.intensity(mm(6), 0)).toBeCloseTo(s.intensity(0, mm(6)), 12)
    expect(s.intensity(mm(6), 0)).toBeCloseTo(s.intensity(mm(-6 * Math.SQRT1_2), mm(6 * Math.SQRT1_2)), 10)
    expect(s.tiltFringeSpacing).toBe(Infinity)
    // The order drops by one between the centre and the radius ρ where
    // 2d(1 − cos θ) = λ, with θ the angle seen from the virtual sources.
    const z = s.arms[0].pathLength - base.laserToLens - base.expanderFocalLength!
    const theta = Math.sqrt(λ / d)
    expect(ringOrder(d, λ, 0) - ringOrder(d, λ, theta)).toBeCloseTo(1, 3)
    expect(s.ringScale / (theta * z)).toBeCloseTo(1, 1)
    // Intensity repeats after one ring.
    const centre = solve({ mirrorDisplacement: d }).centreIntensity
    expect(s.intensity(s.ringScale, 0) / Math.exp((-2 * s.ringScale ** 2) / s.arms[0].radius ** 2)).toBeCloseTo(centre, 1)
  })
  it('rings become larger as the path difference decreases', () => {
    expect(solve({ mirrorDisplacement: mm(0.5) }).ringScale).toBeGreaterThan(solve({ mirrorDisplacement: mm(2) }).ringScale)
  })
  it('a tilted mirror gives straight, equally spaced fringes', () => {
    const tilt = 1e-4
    const s = solve({ tiltX: tilt })
    // Two virtual point sources separated by 2α(a + L) at distance z: spacing λz / (2α(a + L)).
    const sourceToMirror = base.lensToSplitter - base.expanderFocalLength! + base.armLength
    const z = sourceToMirror + base.armLength + base.splitterToScreen
    expect(s.tiltFringeSpacing).toBeCloseTo((λ * z) / (2 * tilt * sourceToMirror), 5)
    // Sampled dark fringes are spaced by exactly that amount.
    const minima: number[] = []
    const step = um(5)
    let a = s.intensity(-step, 0)
    let b = s.intensity(0, 0)
    for (let i = 1; i < 8000 && minima.length < 3; i++) {
      const c = s.intensity(i * step, 0)
      if (b < a && b <= c) minima.push((i - 1) * step)
      a = b
      b = c
    }
    expect(minima[1] - minima[0]).toBeCloseTo(s.tiltFringeSpacing, 5)
    // Fringes run perpendicular to the tilt direction.
    expect(s.intensity(mm(0.4), mm(3))).toBeCloseTo(s.intensity(mm(0.4), mm(-3)), 6)
    // Doubling the tilt halves the spacing.
    expect(solve({ tiltX: 2 * tilt }).tiltFringeSpacing).toBeCloseTo(s.tiltFringeSpacing / 2, 9)
  })
  it('intensity never exceeds the fully constructive value', () => {
    const s = solve({ mirrorDisplacement: mm(0.7), tiltX: 5e-5, tiltY: -3e-5 })
    for (let i = -20; i <= 20; i++) {
      for (let j = -20; j <= 20; j++) {
        const value = s.intensity(mm(i), mm(j))
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })
  it('without the expander lens the beam stays narrow and nearly uniform in phase', () => {
    const s = solve({ expanderFocalLength: null, mirrorDisplacement: λ / 4 })
    expect(s.arms[0].radius).toBeLessThan(mm(1))
    expect(s.centreIntensity).toBeGreaterThan(0.99)
    expect(s.ringScale).toBeGreaterThan(s.arms[0].radius * 5)
    expect(solve({}).arms[0].radius).toBeGreaterThan(mm(8))
  })
})
