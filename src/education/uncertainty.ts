/**
 * Uncertainty of notebook results.
 *
 * A result q(x₁, …, xₙ) computed from readings xᵢ ± Δxᵢ has, for independent
 * readings,
 *
 *   Δq = √( Σ (∂q/∂xᵢ · Δxᵢ)² )
 *
 * The contribution of each reading is found numerically from the analysis
 * function itself, [q(xᵢ + Δxᵢ) − q(xᵢ − Δxᵢ)] / 2, so no derivative has to be
 * written by hand and it cannot drift from the formula used for the result.
 */

/** Propagated uncertainty of f at `values`; null when it cannot be evaluated. */
export function propagate(
  f: (values: Record<string, number>) => number,
  values: Record<string, number>,
  uncertainties: Record<string, number>,
): number | null {
  let sum = 0
  for (const key of Object.keys(values)) {
    const delta = Math.abs(uncertainties[key] ?? 0)
    if (delta === 0) continue
    const upper = f({ ...values, [key]: values[key] + delta })
    const lower = f({ ...values, [key]: values[key] - delta })
    if (!Number.isFinite(upper) || !Number.isFinite(lower)) return null
    sum += ((upper - lower) / 2) ** 2
  }
  return Math.sqrt(sum)
}

/** Propagated uncertainty of each of several results computed together. */
export function propagateAll(
  analyze: (values: Record<string, number>) => number[],
  values: Record<string, number>,
  uncertainties: Record<string, number>,
): (number | null)[] {
  return analyze(values).map((_, index) => propagate((v) => analyze(v)[index], values, uncertainties))
}

export interface SampleStatistics {
  count: number
  mean: number
  /** Standard error of the mean, s / √n; null for fewer than two values. */
  standardError: number | null
}

/** Mean and standard error of repeated determinations of one quantity. */
export function sampleStatistics(values: readonly number[]): SampleStatistics | null {
  const finite = values.filter((value) => Number.isFinite(value))
  const n = finite.length
  if (n === 0) return null
  const mean = finite.reduce((sum, value) => sum + value, 0) / n
  if (n < 2) return { count: n, mean, standardError: null }
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
  return { count: n, mean, standardError: Math.sqrt(variance / n) }
}

/** How many uncertainties separate a result from the accepted value; null when the uncertainty is zero or unknown. */
export function sigmaDistance(value: number, uncertainty: number | null, accepted: number): number | null {
  if (uncertainty === null || !(uncertainty > 0)) return null
  return Math.abs(value - accepted) / uncertainty
}

/** Plain statement of the agreement between a result and the accepted value. */
export function agreement(value: number, uncertainty: number | null, accepted: number): string | null {
  const sigma = sigmaDistance(value, uncertainty, accepted)
  if (sigma === null) return null
  if (sigma <= 1) return 'agrees within the uncertainty'
  if (sigma <= 2) return `agrees within 2 uncertainties (${sigma.toFixed(1)} σ)`
  return `differs by ${sigma.toFixed(1)} uncertainties`
}

/** Decimal places needed to show an uncertainty to one or two significant figures. */
export function uncertaintyDigits(uncertainty: number | null, fallback: number): number {
  if (uncertainty === null || !(uncertainty > 0)) return fallback
  const magnitude = Math.floor(Math.log10(uncertainty))
  // Two significant figures when the leading digit is 1, one otherwise.
  const leading = uncertainty / 10 ** magnitude
  return Math.max(0, Math.min(8, -magnitude + (leading < 2 ? 1 : 0)))
}
