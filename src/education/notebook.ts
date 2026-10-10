/**
 * Analysis of the lab notebook: results with propagated uncertainties, the
 * summary of repeated measurements, and the straight-line fit.
 */
import type { NotebookResult, NotebookRow } from '../state/labState'
import type { AnalysisContext, ExperimentDefinition } from './experiments'
import { linearFit } from './fit'
import type { DataPoint, LinearFit } from './fit'
import { propagateAll, sampleStatistics } from './uncertainty'
import type { SampleStatistics } from './uncertainty'

/** Results of one measurement, each with the uncertainty that follows from the readings. */
export function analyzeMeasurement(
  definition: ExperimentDefinition,
  values: Record<string, number>,
  uncertainties: Record<string, number>,
  context: AnalysisContext,
): NotebookResult[] {
  const results = definition.analyze(values, context)
  const propagated = propagateAll((v) => definition.analyze(v, context).map((entry) => entry.value), values, uncertainties)
  return results.map((entry, index) => ({ ...entry, uncertainty: propagated[index] }))
}

/** Reading uncertainty of every field, as declared by the experiment. */
export function defaultUncertainties(definition: ExperimentDefinition): Record<string, number> {
  return Object.fromEntries(definition.fields.map((field) => [field.key, field.uncertainty]))
}

export interface ResultSummary {
  label: string
  unit: string
  digits: number
  theory: number | null
  statistics: SampleStatistics
}

/**
 * Mean and standard error over the recorded rows of each result that is a
 * property of the apparatus. Results that change with the setting (an angle,
 * a magnification) have no meaningful mean and are left out.
 */
export function summarizeRows(rows: readonly NotebookRow[]): ResultSummary[] {
  if (rows.length === 0) return []
  return rows[0].results.flatMap((first, index) => {
    if (first.perSetting) return []
    const statistics = sampleStatistics(rows.map((row) => row.results[index]?.value ?? NaN))
    return statistics ? [{ label: first.label, unit: first.unit, digits: first.digits, theory: first.theory, statistics }] : []
  })
}

export interface NotebookFit {
  points: DataPoint[]
  /** Null with fewer than three plottable rows. */
  fit: LinearFit | null
  results: NotebookResult[]
}

/** Linearised points of the recorded rows and the line fitted through them; null when the experiment has no graph. */
export function fitRows(definition: ExperimentDefinition, rows: readonly NotebookRow[], context: AnalysisContext): NotebookFit | null {
  const plot = definition.plot
  if (!plot) return null
  const points = rows.flatMap((row) => {
    const point = plot.point(row.values, context)
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? [point] : []
  })
  const fit = linearFit(points)
  return { points, fit, results: fit ? plot.interpret(fit, context) : [] }
}
