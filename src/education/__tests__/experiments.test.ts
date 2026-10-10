/**
 * Regression tests of the experiments as the app runs them: each preset is
 * loaded and solved, the numbers the lab would display are compared with the
 * governing equation evaluated independently, and ideal measurements are fed
 * through the notebook analysis.
 */
import { describe, expect, it } from 'vitest'
import { HENE_WAVELENGTH, laserLine } from '../../physics/constants'
import { opticalGlass, refractiveIndex } from '../../physics/dispersion'
import { solveMichelson } from '../../physics/michelson'
import { solveBench } from '../../physics/optics'
import type { BenchSolution } from '../../physics/optics'
import { minimumDeviation, solvePrism } from '../../physics/prism'
import { solveSurface } from '../../physics/surface'
import type { BenchComponent } from '../../physics/types'
import { cm, degToRad, fromMeters, mm, radToDeg, um } from '../../physics/units'
import { DEFAULT_PRISM, benchPreset, surfacePreset } from '../../state/presets'
import type { ExperimentId } from '../../state/presets'
import { SWEEP_LABELS } from '../../state/sweeps'
import { EXPERIMENTS, experiment } from '../experiments'
import type { AnalysisContext } from '../experiments'
import { analyzeMeasurement, defaultUncertainties, fitRows } from '../notebook'

const options = { diffractionModel: 'fraunhofer' as const }
const SURFACE_EXPERIMENTS: ExperimentId[] = ['reflection', 'refraction', 'brewster']

function bench(id: ExperimentId, change?: (components: BenchComponent[]) => BenchComponent[]) {
  const preset = benchPreset(id)!
  const components = change ? change(preset.components) : preset.components
  const solution = solveBench(components, options)
  const context: AnalysisContext = { components, bench: solution, surface: null, michelson: null, prism: null }
  return { components, solution, context }
}
const moveScreen = (x: number) => (components: BenchComponent[]) => components.map((c) => (c.kind === 'screen' ? { ...c, x } : c))
const find = <K extends BenchComponent['kind']>(components: BenchComponent[], kind: K) =>
  components.find((c): c is Extract<BenchComponent, { kind: K }> => c.kind === kind)!

/** Values of the named notebook results for one measurement. */
function analyze(id: ExperimentId, values: Record<string, number>, context: AnalysisContext) {
  const definition = experiment(id)
  return analyzeMeasurement(definition, values, defaultUncertainties(definition), context)
}

describe('experiment catalogue', () => {
  const ids = EXPERIMENTS.map((entry) => entry.id)

  it('numbers the experiments 1…16 without gaps or duplicates', () => {
    expect(EXPERIMENTS.map((entry) => entry.number)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every experiment a guide, measurement fields with a reading uncertainty, and a sweep', () => {
    for (const entry of EXPERIMENTS) {
      expect(entry.goal.length).toBeGreaterThan(20)
      expect(entry.procedure.length).toBeGreaterThanOrEqual(3)
      expect(entry.equations.length).toBeGreaterThan(0)
      expect(entry.assumptions.length).toBeGreaterThan(0)
      expect(entry.fields.length).toBeGreaterThan(0)
      for (const field of entry.fields) expect(field.uncertainty).toBeGreaterThanOrEqual(0)
      expect(SWEEP_LABELS[entry.id]).toBeTruthy()
    }
  })

  it('gives every experiment a starting configuration in its section', () => {
    for (const id of ids) {
      const hasBench = benchPreset(id) !== null
      const hasSurface = surfacePreset(id) !== null
      const standalone = id === 'michelson' || id === 'prism'
      expect([hasBench, hasSurface, standalone].filter(Boolean)).toHaveLength(1)
      expect(hasSurface).toBe(SURFACE_EXPERIMENTS.includes(id))
    }
  })

  it('solves every bench preset without an error notice', () => {
    for (const id of ids) {
      const preset = benchPreset(id)
      if (!preset) continue
      const solution = solveBench(preset.components, options)
      expect(solution.regime, id).not.toBe('unsupported')
      expect(solution.regime, id).not.toBe('no-source')
      expect(solution.notices.filter((n) => n.level === 'error'), id).toEqual([])
      expect(solution.screenLight, id).not.toBeNull()
      expect(solution.screenLight!.kind, id).not.toBe('dark')
    }
  })
})

describe('experiment 1: law of reflection', () => {
  it('reflects at θr = θi = 35°', () => {
    const surface = solveSurface(surfacePreset('reflection')!)
    expect(radToDeg(surface.incidentAngle)).toBeCloseTo(35, 10)
    expect(radToDeg(surface.reflectedAngle!)).toBeCloseTo(35, 10)
    const results = analyze('reflection', { thetaI: 35, thetaR: 35 }, { components: [], bench: null, surface, michelson: null, prism: null })
    expect(results[2].value).toBe(0)
    // Δ(θr − θi) = √2 × 0.5°
    expect(results[2].uncertainty!).toBeCloseTo(Math.SQRT2 * 0.5, 10)
  })
})

describe("experiment 2: Snell's law", () => {
  it('refracts air → water at 40° to sin⁻¹(sin 40° × 1.000293 / 1.333) = 28.84°', () => {
    const surface = solveSurface(surfacePreset('refraction')!)
    const expected = radToDeg(Math.asin((1.000293 * Math.sin(degToRad(40))) / 1.333))
    expect(expected).toBeCloseTo(28.84, 2)
    expect(radToDeg(surface.refractedAngle!)).toBeCloseTo(expected, 10)
    const context: AnalysisContext = { components: [], bench: null, surface, michelson: null, prism: null }
    const results = analyze('refraction', { theta1: 40, theta2: expected }, context)
    expect(results[0].value).toBeCloseTo(1.333, 10)
    expect(results[0].theory).toBe(1.333)
    // sin θ₁ against sin θ₂ is a line of slope n₂/n₁.
    const definition = experiment('refraction')
    const rows = [20, 40, 60].map((theta1, i) => {
      const theta2 = radToDeg(Math.asin((1.000293 * Math.sin(degToRad(theta1))) / 1.333))
      const values = { theta1, theta2 }
      return { id: `r${i}`, values, uncertainties: defaultUncertainties(definition), results: analyze('refraction', values, context) }
    })
    expect(fitRows(definition, rows, context)!.results[0].value).toBeCloseTo(1.333, 8)
  })
})

describe('experiment 3: convex lens', () => {
  it('images do = 30 cm through f = 10 cm at di = 15 cm; the preset screen starts out of focus', () => {
    const start = bench('convex-lens')
    expect(start.solution.imaging!.screen!.inFocus).toBe(false)
    const { solution, context } = bench('convex-lens', moveScreen(cm(60)))
    const stage = solution.imaging!.sequence!.stages[0]
    expect(fromMeters(stage.objectDistance, 'cm')).toBeCloseTo(30, 10)
    expect(fromMeters(stage.imageDistance, 'cm')).toBeCloseTo(1 / (1 / 10 - 1 / 30), 10)
    expect(solution.imaging!.screen!.inFocus).toBe(true)
    const results = analyze('convex-lens', { do: 30, di: 15 }, context)
    expect(results[0].value).toBeCloseTo(10, 10)
    expect(results[0].theory).toBeCloseTo(10, 10)
    expect(results[1].value).toBeCloseTo(-0.5, 10)
  })
})

describe('experiment 4: magnification', () => {
  it('gives m = −2 and a 30 mm inverted image of the 15 mm object', () => {
    const { solution, context } = bench('magnification')
    expect(solution.imaging!.sequence!.magnification).toBeCloseTo(-2, 10)
    expect(fromMeters(solution.imaging!.imageHeight!, 'mm')).toBeCloseTo(-30, 10)
    expect(solution.imaging!.screen!.inFocus).toBe(true)
    const results = analyze('magnification', { ho: 15, hi: -30, do: 22.5, di: 45 }, context)
    expect(results[0].value).toBeCloseTo(-2, 10)
    expect(results[1].value).toBeCloseTo(-2, 10)
  })
})

describe('experiment 5: He-Ne laser through a lens', () => {
  it('focuses the beam just beyond f, at f + (s − f) f² / ((s − f)² + z_R²)', () => {
    const { solution, context } = bench('hene-lens')
    const zR = (Math.PI * mm(0.405) ** 2) / HENE_WAVELENGTH
    const s = cm(32)
    const f = cm(10)
    const expected = f + ((s - f) * f * f) / ((s - f) ** 2 + zR ** 2)
    const waist = solution.beam!.path.waists[1]
    expect(waist.x - cm(40)).toBeCloseTo(expected, 10)
    expect(fromMeters(expected, 'cm')).toBeCloseTo(10.31, 2)
    const results = analyze('hene-lens', { focus: fromMeters(expected, 'cm') }, context)
    expect(results[1].theory!).toBeCloseTo(results[1].value, 8)
  })
})

describe('experiment 6: single slit', () => {
  it('has a central maximum of width 2 L tan(sin⁻¹(λ/a)) = 13.92 mm', () => {
    const { solution, context } = bench('single-slit')
    const expected = 2 * 1.1 * Math.tan(Math.asin(632.8e-9 / 0.1e-3))
    expect(fromMeters(expected, 'mm')).toBeCloseTo(13.92, 2)
    expect(solution.diffraction!.centralMaximumWidth).toBeCloseTo(expected, 12)
    expect(solution.diffraction!.regime).toBe('far-field')
    const results = analyze('single-slit', { L: 110, W: fromMeters(expected, 'mm') }, context)
    expect(results[0].value).toBeCloseTo(0.1, 4)
  })
})

describe('experiment 7: double slit', () => {
  it('has fringes spaced λL/d = 2.784 mm', () => {
    const { solution, context } = bench('double-slit')
    const expected = (632.8e-9 * 1.1) / 0.25e-3
    expect(solution.diffraction!.fringeSpacing!).toBeCloseTo(expected, 12)
    const results = analyze('double-slit', { L: 110, dy: fromMeters(expected, 'mm') }, context)
    expect(results[0].value).toBeCloseTo(632.8, 8)
    // Δλ/λ = √((ΔΔy/Δy)² + (ΔL/L)²) with Δy ± 0.05 mm, L ± 0.1 cm
    expect(results[0].uncertainty! / 632.8).toBeCloseTo(Math.hypot(0.05 / 2.7843, 0.1 / 110), 4)
  })
})

describe('experiment 8: tungsten source', () => {
  it('images at unit magnification with do = di = 2f = 40 cm, whatever the lamp intensity', () => {
    const { solution, context, components } = bench('tungsten')
    expect(solution.imaging!.sequence!.magnification).toBeCloseTo(-1, 10)
    expect(solution.imaging!.screen!.inFocus).toBe(true)
    const dim = solveBench(components.map((c) => (c.kind === 'tungsten' ? { ...c, intensity: 0.2 } : c)), options)
    expect(dim.imaging!.sequence!.imageX).toBe(solution.imaging!.sequence!.imageX)
    if (dim.screenLight?.kind !== 'image' || solution.screenLight?.kind !== 'image') throw new Error('expected images')
    expect(dim.screenLight.level / solution.screenLight.level).toBeCloseTo(0.2 / 0.6, 10)
    expect(analyze('tungsten', { intensity: 60, do: 40, di: 40 }, context)[0].value).toBeCloseTo(20, 10)
  })
})

describe('experiment 9: Michelson interferometer', () => {
  it('passes one fringe per λ/2 of mirror travel', () => {
    const setup = { wavelength: HENE_WAVELENGTH, waistRadius: mm(0.405), laserToLens: cm(10), expanderFocalLength: cm(2), lensToSplitter: cm(10), armLength: cm(15), tiltX: 0, tiltY: 0, splitterToScreen: cm(25) }
    const before = solveMichelson({ ...setup, mirrorDisplacement: mm(4) })
    const after = solveMichelson({ ...setup, mirrorDisplacement: mm(4) + um(10) })
    const passed = after.centreOrder - before.centreOrder
    expect(passed).toBeCloseTo((2 * 10e-6) / 632.8e-9, 6)
    const context: AnalysisContext = { components: [], bench: null, surface: null, michelson: after, prism: null }
    expect(analyze('michelson', { dd: 10, N: passed }, context)[0].value).toBeCloseTo(632.8, 6)
  })
})

describe('experiment 10: concave lens', () => {
  it('moves the image from 10 cm to 30 cm behind the f = −15 cm lens', () => {
    const { components, context } = bench('concave-lens', moveScreen(cm(75)))
    const concave = components.find((c) => c.kind === 'lens' && c.focalLength < 0)!
    // Step 1 of the procedure: with the concave lens beyond the screen, the image is at 55 cm.
    const alone = solveBench(components.map((c) => (c.id === concave.id ? { ...c, x: cm(140) } : c.kind === 'screen' ? { ...c, x: cm(55) } : c)), options)
    expect(alone.imaging!.sequence!.stages).toHaveLength(1)
    expect(alone.imaging!.screen!.inFocus).toBe(true)
    // Step 2: with it in place the image is at 75 cm.
    expect(context.bench!.imaging!.screen!.inFocus).toBe(true)
    const s = 55 - 45
    const di = 75 - 45
    expect(1 / (1 / di - 1 / s)).toBeCloseTo(-15, 10)
    const results = analyze('concave-lens', { s, di }, context)
    expect(results[0].value).toBeCloseTo(-15, 10)
    expect(results[0].theory).toBeCloseTo(-15, 10)
  })
})

describe('experiment 11: diffraction grating', () => {
  it('puts the first order at L tan(sin⁻¹(λ/d)) = 48.34 mm and returns λ', () => {
    const { solution, context } = bench('grating')
    const expected = 0.25 * Math.tan(Math.asin(632.8e-9 * 300e3))
    expect(solution.grating!.orders[1].position!).toBeCloseTo(expected, 12)
    const results = analyze('grating', { L: 25, y: fromMeters(expected, 'mm'), m: 1 }, context)
    expect(results[0].value).toBeCloseTo(632.8, 8)
    expect(results[0].theory).toBeCloseTo(632.8, 8)
    expect(results[1].value).toBeCloseTo(results[1].theory!, 8)
    // The spec scenario: readings rounded to the scale give λ within 0.5 nm.
    expect(Math.abs(analyze('grating', { L: 25, y: 48.3, m: 1 }, context)[0].value - 632.8)).toBeLessThan(0.5)
  })

  it('gives a line of slope λ/d for sin θ against m', () => {
    const { context } = bench('grating', moveScreen(cm(108)))
    const definition = experiment('grating')
    const rows = [1, 2, 3].map((m, i) => {
      const values = { L: 8, y: fromMeters(0.08 * Math.tan(Math.asin(m * 632.8e-9 * 300e3)), 'mm'), m }
      return { id: `r${i}`, values, uncertainties: defaultUncertainties(definition), results: analyze('grating', values, context) }
    })
    expect(fitRows(definition, rows, context)!.results[0].value).toBeCloseTo(632.8, 6)
  })
})

describe('experiment 12: circular aperture', () => {
  it('has its first dark ring at 1.22 λ L / D = 4.245 mm and returns D', () => {
    const { solution, context } = bench('airy')
    const expected = 1.1 * Math.tan(Math.asin((1.2196698912665045 * 632.8e-9) / 0.2e-3))
    expect(solution.airy!.firstDarkRingRadius).toBeCloseTo(expected, 12)
    expect(fromMeters(expected, 'mm')).toBeCloseTo(4.245, 3)
    const results = analyze('airy', { L: 110, ring: 2 * fromMeters(expected, 'mm') }, context)
    expect(results[0].value).toBeCloseTo(0.2, 5)
    expect(Math.abs(analyze('airy', { L: 110, ring: 8.49 }, context)[0].value - 0.2)).toBeLessThan(0.002)
  })
})

describe("experiment 13: Malus's law", () => {
  it('reads ½ cos²θ at the screen: 37.5 % at 30°', () => {
    const { solution, components } = bench('malus')
    expect(solution.polarization!.transmission).toBeCloseTo(0.5 * Math.cos(degToRad(30)) ** 2, 12)
    const analyser = components.filter((c) => c.kind === 'polarizer')[1]
    for (const theta of [0, 20, 45, 60, 90]) {
      const turned = solveBench(components.map((c) => (c.id === analyser.id ? { ...c, angle: degToRad(theta) } : c)), options)
      expect(turned.polarization!.transmission).toBeCloseTo(0.5 * Math.cos(degToRad(theta)) ** 2, 12)
    }
    const context: AnalysisContext = { components, bench: solution, surface: null, michelson: null, prism: null }
    const results = analyze('malus', { theta: 30, I: 37.5, I0: 50 }, context)
    expect(results[0].value).toBeCloseTo(0.75, 12)
    expect(results[0].theory).toBeCloseTo(0.75, 12)
  })
})

describe("experiment 14: Brewster's angle", () => {
  it('loses the reflected p-ray at tan⁻¹(1.5168 / 1.000293) = 56.60°', () => {
    const preset = surfacePreset('brewster')!
    expect(preset.polarization).toBe('p')
    const thetaB = radToDeg(Math.atan(1.5168 / 1.000293))
    const surface = solveSurface({ ...preset, sourceAngle: degToRad(90 + thetaB) })
    expect(surface.reflectance).toBeCloseTo(0, 12)
    expect(solveSurface({ ...preset, sourceAngle: degToRad(90 + thetaB - 5) }).reflectance).toBeGreaterThan(1e-3)
    expect(solveSurface({ ...preset, sourceAngle: degToRad(90 + thetaB + 5) }).reflectance).toBeGreaterThan(1e-3)
    const context: AnalysisContext = { components: [], bench: null, surface, michelson: null, prism: null }
    const results = analyze('brewster', { thetaB }, context)
    expect(results[0].value).toBeCloseTo(1.5168, 10)
    expect(results[1].theory).toBeCloseTo(thetaB, 10)
    expect(Math.abs(analyze('brewster', { thetaB: 56.6 }, context)[0].value - 1.5168)).toBeLessThan(0.01)
  })
})

describe('experiment 15: prism', () => {
  it('has minimum deviation 38.50° for BK7 at 632.8 nm, from which n = 1.5151', () => {
    const glass = opticalGlass(DEFAULT_PRISM.glassId)
    const wavelength = laserLine(DEFAULT_PRISM.light).wavelength
    const index = refractiveIndex(glass, wavelength)
    const expected = radToDeg(2 * Math.asin(index * Math.sin(DEFAULT_PRISM.apexAngle / 2)) - DEFAULT_PRISM.apexAngle)
    expect(expected).toBeCloseTo(38.496, 2)
    expect(radToDeg(minimumDeviation(DEFAULT_PRISM.apexAngle, index)!)).toBeCloseTo(expected, 10)
    // Scanning the angle of incidence in 0.1° steps, as the slider does, finds that minimum.
    let smallest = Infinity
    for (let tenths = 300; tenths <= 890; tenths++) {
      const deviation = solvePrism({ apexAngle: DEFAULT_PRISM.apexAngle, incidenceAngle: degToRad(tenths / 10), index }).deviation
      if (deviation !== null) smallest = Math.min(smallest, radToDeg(deviation))
    }
    expect(smallest).toBeCloseTo(expected, 3)
    const context: AnalysisContext = { components: [], bench: null, surface: null, michelson: null, prism: { apexAngle: DEFAULT_PRISM.apexAngle, wavelength, index } }
    const results = analyze('prism', { dmin: smallest }, context)
    expect(results[0].value).toBeCloseTo(index, 5)
    expect(results[0].theory).toBeCloseTo(1.51509, 5)
  })
})

describe('experiment 16: concave mirror', () => {
  it('images do = 30 cm in an f = 20 cm mirror at di = 60 cm with m = −2', () => {
    const start = bench('concave-mirror')
    expect(start.solution.imaging!.screen!.inFocus).toBe(false)
    const { solution, context, components } = bench('concave-mirror', moveScreen(cm(40)))
    const mirror = find(components, 'mirror')
    const object = find(components, 'object')
    const objectDistance = mirror.x - object.x
    const expected = 1 / (1 / mirror.focalLength - 1 / objectDistance)
    expect(fromMeters(expected, 'cm')).toBeCloseTo(60, 10)
    expect(solution.imaging!.sequence!.stages[0].imageDistance).toBeCloseTo(expected, 12)
    expect(solution.imaging!.screen!.inFocus).toBe(true)
    const results = analyze('concave-mirror', { do: 30, di: 60 }, context)
    expect(results.map((r) => r.value)).toEqual([expect.closeTo(20, 10), expect.closeTo(40, 10), expect.closeTo(-2, 10)])
    expect(results.map((r) => r.theory)).toEqual([expect.closeTo(20, 10), expect.closeTo(40, 10), expect.closeTo(-2, 10)])
  })
})

describe('demonstration sweeps', () => {
  it('keeps every bench experiment solvable at the ends and middle of its sweep', async () => {
    const { actions, labStore } = await import('../../state/labState')
    const { applySweep } = await import('../../state/sweeps')
    for (const entry of EXPERIMENTS) {
      if (!benchPreset(entry.id)) continue
      actions.loadExperiment(entry.id)
      for (const t of [0, 0.5, 1]) {
        applySweep(entry.id, t)
        const solution: BenchSolution = solveBench(labStore.get().components, options)
        expect(solution.regime, `${entry.id} at t = ${t}`).not.toBe('unsupported')
        expect(solution.screenLight, `${entry.id} at t = ${t}`).not.toBeNull()
      }
    }
  })

  it('keeps the screen in the image plane while the concave lens and the mirror object are swept', async () => {
    const { actions, labStore } = await import('../../state/labState')
    const { applySweep } = await import('../../state/sweeps')
    for (const id of ['concave-lens', 'concave-mirror'] as const) {
      actions.loadExperiment(id)
      for (const t of [0, 0.3, 0.7, 1]) {
        applySweep(id, t)
        const solution = solveBench(labStore.get().components, options)
        // Positions snap to the millimetre scale, so allow the blur that 0.5 mm of defocus gives.
        expect(solution.imaging!.screen!.blurDiameter, `${id} at t = ${t}`).toBeLessThan(mm(0.2))
      }
    }
  })
})
