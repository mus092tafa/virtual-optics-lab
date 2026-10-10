import { describe, expect, it } from 'vitest'
import { DEFAULT_LENS_APERTURE } from '../../physics/constants'
import { solveBench } from '../../physics/optics'
import type { BenchComponent } from '../../physics/types'
import { cm, mm } from '../../physics/units'
import type { NotebookRow } from '../../state/labState'
import { experiment } from '../experiments'
import type { AnalysisContext } from '../experiments'
import { linearFit } from '../fit'
import { buildLabReport, escapeHtml, formatWithUncertainty } from '../labReport'
import { analyzeMeasurement, defaultUncertainties, fitRows, summarizeRows } from '../notebook'
import { agreement, propagate, sampleStatistics, sigmaDistance, uncertaintyDigits } from '../uncertainty'

const components: BenchComponent[] = [
  { id: 'lamp', kind: 'tungsten', x: cm(5), intensity: 1, sourceSize: mm(4) },
  { id: 'object', kind: 'object', x: cm(15), shape: 'arrow', height: mm(20), letter: 'F' },
  { id: 'lens', kind: 'lens', x: cm(45), focalLength: cm(10), aperture: DEFAULT_LENS_APERTURE, concealed: false },
  { id: 'screen', kind: 'screen', x: cm(60) },
]
const context: AnalysisContext = {
  components,
  bench: solveBench(components, { diffractionModel: 'fraunhofer' }),
  surface: null,
  michelson: null,
  prism: null,
}
const lens = experiment('convex-lens')
const row = (id: string, values: Record<string, number>): NotebookRow => {
  const uncertainties = defaultUncertainties(lens)
  return { id, values, uncertainties, results: analyzeMeasurement(lens, values, uncertainties, context) }
}

describe('uncertainty propagation', () => {
  it('matches the analytic result for the thin lens: Δf = f² √((Δdo/do²)² + (Δdi/di²)²)', () => {
    const f = (v: Record<string, number>) => 1 / (1 / v.do + 1 / v.di)
    const delta = propagate(f, { do: 30, di: 15 }, { do: 0.1, di: 0.1 })!
    const analytic = 100 * Math.hypot(0.1 / 900, 0.1 / 225)
    expect(analytic).toBeCloseTo(0.04581, 5)
    expect(delta).toBeCloseTo(analytic, 5)
  })

  it('adds independent contributions in quadrature and is exact for a linear function', () => {
    const f = (v: Record<string, number>) => 3 * v.a - 4 * v.b
    expect(propagate(f, { a: 1, b: 2 }, { a: 0.1, b: 0.1 })).toBeCloseTo(0.5, 12)
    expect(propagate(f, { a: 1, b: 2 }, { a: 0.1, b: 0 })).toBeCloseTo(0.3, 12)
  })

  it('is zero when every reading is exact, and null when the result cannot be evaluated', () => {
    const f = (v: Record<string, number>) => v.a * v.a
    expect(propagate(f, { a: 2 }, { a: 0 })).toBe(0)
    expect(propagate(f, { a: 2 }, {})).toBe(0)
    expect(propagate((v) => Math.asin(v.a), { a: 0.95 }, { a: 0.1 })).toBeNull()
  })

  it('gives the notebook result f = 10.00 ± 0.05 cm for do = 30.0 ± 0.1, di = 15.0 ± 0.1', () => {
    const results = analyzeMeasurement(lens, { do: 30, di: 15 }, { do: 0.1, di: 0.1 }, context)
    expect(results[0].value).toBeCloseTo(10, 10)
    expect(results[0].uncertainty!).toBeCloseTo(0.0458, 3)
    expect(formatWithUncertainty(results[0].value, results[0].uncertainty, 'cm', 2)).toBe('10.00 ± 0.05 cm')
    // m = −di/do = −0.5, Δm = |m| √((Δdo/do)² + (Δdi/di)²) = 0.0037
    expect(results[1].uncertainty!).toBeCloseTo(0.5 * Math.hypot(0.1 / 30, 0.1 / 15), 5)
    expect(analyzeMeasurement(lens, { do: 30, di: 15 }, { do: 0, di: 0 }, context)[0].uncertainty).toBe(0)
  })

  it('takes the reading uncertainty of each field from the experiment', () => {
    expect(defaultUncertainties(lens)).toEqual({ do: 0.1, di: 0.1 })
  })

  it('summarises repeated values by their mean and standard error', () => {
    const stats = sampleStatistics([9.9, 10.0, 10.1])!
    expect(stats.mean).toBeCloseTo(10, 12)
    // s = 0.1, s/√3 = 0.0577
    expect(stats.standardError!).toBeCloseTo(0.1 / Math.sqrt(3), 12)
    expect(sampleStatistics([4])).toEqual({ count: 1, mean: 4, standardError: null })
    expect(sampleStatistics([])).toBeNull()
  })

  it('states the agreement with the accepted value in units of the uncertainty', () => {
    expect(sigmaDistance(10.03, 0.05, 10)).toBeCloseTo(0.6, 10)
    expect(agreement(10.03, 0.05, 10)).toBe('agrees within the uncertainty')
    expect(agreement(10.08, 0.05, 10)).toContain('within 2 uncertainties')
    expect(agreement(10.2, 0.05, 10)).toBe('differs by 4.0 uncertainties')
    expect(agreement(10.2, 0, 10)).toBeNull()
    expect(agreement(10.2, null, 10)).toBeNull()
  })

  it('rounds to the precision of the uncertainty', () => {
    expect(uncertaintyDigits(0.0458, 2)).toBe(2)
    expect(uncertaintyDigits(0.012, 2)).toBe(3)
    expect(uncertaintyDigits(3, 2)).toBe(0)
    expect(uncertaintyDigits(null, 2)).toBe(2)
    expect(formatWithUncertainty(632.84, 4.2, 'nm', 1)).toBe('633 ± 4 nm')
    expect(formatWithUncertainty(-15.02, 0, 'cm', 2)).toBe('−15.02 cm')
  })
})

describe('least-squares line', () => {
  it('recovers an exact line with zero standard errors', () => {
    const fit = linearFit([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }])!
    expect(fit.slope).toBeCloseTo(2, 12)
    expect(fit.intercept).toBeCloseTo(1, 12)
    expect(fit.slopeError).toBeCloseTo(0, 10)
    expect(fit.interceptError).toBeCloseTo(0, 10)
    expect(fit.r2).toBeCloseTo(1, 12)
  })

  it('matches a hand-computed fit with scatter', () => {
    // x̄ = 2.5, ȳ = 5.1, Sxx = 5, Sxy = 9.9 -> b = 1.98, a = 0.15; fitted 2.13, 4.11, 6.09, 8.07 -> Σr² = 0.098; Syy = 19.7.
    const fit = linearFit([{ x: 1, y: 2.2 }, { x: 2, y: 3.9 }, { x: 3, y: 6.3 }, { x: 4, y: 8.0 }])!
    expect(fit.slope).toBeCloseTo(1.98, 10)
    expect(fit.intercept).toBeCloseTo(0.15, 10)
    const variance = 0.098 / 2
    expect(fit.slopeError).toBeCloseTo(Math.sqrt(variance / 5), 10)
    expect(fit.interceptError).toBeCloseTo(Math.sqrt(variance * (1 / 4 + 6.25 / 5)), 10)
    expect(fit.r2).toBeCloseTo(1 - 0.098 / 19.7, 10)
  })

  it('needs three points with distinct x', () => {
    expect(linearFit([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull()
    expect(linearFit([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }])).toBeNull()
  })

  it('reads f from the intercept of 1/di against 1/do', () => {
    // Exact conjugate pairs of an f = 10 cm lens.
    const rows = [15, 20, 30, 40].map((d, i) => row(`r${i}`, { do: d, di: 1 / (1 / 10 - 1 / d) }))
    const fitted = fitRows(lens, rows, context)!
    expect(fitted.points).toHaveLength(4)
    expect(fitted.fit!.slope).toBeCloseTo(-1, 10)
    expect(fitted.fit!.intercept).toBeCloseTo(0.1, 10)
    expect(fitted.results[0].value).toBeCloseTo(10, 8)
    expect(fitted.results[0].theory).toBeCloseTo(10, 10)
    // Δf = Δb / b²
    const noisy = fitRows(lens, [row('a', { do: 15, di: 30.4 }), row('b', { do: 20, di: 19.8 }), row('c', { do: 30, di: 15.1 }), row('d', { do: 40, di: 13.3 })], context)!
    expect(noisy.results[0].uncertainty!).toBeCloseTo(noisy.fit!.interceptError / noisy.fit!.intercept ** 2, 10)
    expect(Math.abs(noisy.results[0].value - 10)).toBeLessThan(3 * noisy.results[0].uncertainty!)
  })

  it('shows points without a line until three rows are recorded, and nothing for experiments without a graph', () => {
    const fitted = fitRows(lens, [row('a', { do: 30, di: 15 }), row('b', { do: 20, di: 20 })], context)!
    expect(fitted.points).toHaveLength(2)
    expect(fitted.fit).toBeNull()
    expect(fitted.results).toEqual([])
    expect(fitRows(experiment('brewster'), [], context)).toBeNull()
  })
})

describe('lab report', () => {
  const rows = [row('a', { do: 30, di: 15.1 }), row('b', { do: 20, di: 19.9 }), row('c', { do: 15, di: 30.2 })]
  const build = (showTheory: boolean, student = 'A. Student') =>
    buildLabReport({
      definition: lens,
      rows,
      summary: summarizeRows(rows),
      fit: fitRows(lens, rows, context),
      given: [],
      setup: [{ title: 'Bench layout', rows: [{ label: 'Screen position', value: '60.0 cm' }] }],
      showTheory,
      student,
      date: '2026-10-10',
    })

  it('contains the experiment, every recorded row, the summary and the graph', () => {
    const html = build(true)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Experiment 3 — Convex Lens — Focal Length')
    expect(html).toContain('A. Student')
    expect(html).toContain('1/f = 1/do + 1/di')
    expect(html).toContain('<td>30 ± 0.1</td><td>15.1 ± 0.1</td>')
    expect(html).toContain('<td>15 ± 0.1</td><td>30.2 ± 0.1</td>')
    expect(html.match(/<tr><td>\d<\/td>/g)).toHaveLength(3)
    expect(html).toContain('Mean of 3 measurements')
    expect(html).toContain('<svg')
    expect(html).toContain('Slope')
    expect(html).toContain('Screen position')
    // No scripts or external resources: the file is self-contained.
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/(src|href)=/)
  })

  it('includes accepted values only when the theory is visible', () => {
    expect(build(true)).toContain('accepted 10.00 cm')
    expect(build(false)).not.toContain('accepted')
  })

  it('writes what the student typed as text, not markup', () => {
    const html = build(true, '<img src=x onerror=alert(1)> & co')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; co')
    expect(escapeHtml(`"a" < 'b'`)).toBe('&quot;a&quot; &lt; &#39;b&#39;')
  })

  it('says so when nothing was recorded', () => {
    const html = buildLabReport({ definition: lens, rows: [], summary: [], fit: null, given: [], setup: [], showTheory: true, student: '', date: '2026-10-10' })
    expect(html).toContain('No measurements were recorded.')
  })

  it('summarises each result over the rows', () => {
    const summary = summarizeRows(rows)
    // The focal length is averaged; the magnification differs from row to row and is not.
    expect(summary.map((entry) => entry.label)).toEqual(['f = (1/do + 1/di)⁻¹'])
    const values = rows.map((r) => r.results[0].value)
    expect(summary[0].statistics.mean).toBeCloseTo(values.reduce((a, b) => a + b, 0) / 3, 12)
    expect(summarizeRows([])).toEqual([])
  })
})
