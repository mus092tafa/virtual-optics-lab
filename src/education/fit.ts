/**
 * Unweighted least-squares fit of a straight line y = a + b x.
 *
 *   b = S_xy / S_xx          a = ȳ − b x̄
 *   s² = Σ rᵢ² / (n − 2)     (variance of the residuals)
 *   σ_b = √(s² / S_xx)       σ_a = √(s² (1/n + x̄² / S_xx))
 */

export interface DataPoint {
  x: number
  y: number
}

export interface LinearFit {
  slope: number
  intercept: number
  /** Standard errors of the slope and intercept. */
  slopeError: number
  interceptError: number
  /** Coefficient of determination R². */
  r2: number
  count: number
}

/** Fewest points for which the standard errors are defined. */
export const MIN_FIT_POINTS = 3

/** Null when there are fewer than three points or they all share one x. */
export function linearFit(points: readonly DataPoint[]): LinearFit | null {
  const n = points.length
  if (n < MIN_FIT_POINTS) return null
  let meanX = 0
  let meanY = 0
  for (const point of points) {
    meanX += point.x / n
    meanY += point.y / n
  }
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const point of points) {
    sxx += (point.x - meanX) ** 2
    sxy += (point.x - meanX) * (point.y - meanY)
    syy += (point.y - meanY) ** 2
  }
  if (!(sxx > 0)) return null
  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  let residual = 0
  for (const point of points) residual += (point.y - intercept - slope * point.x) ** 2
  const variance = residual / (n - 2)
  return {
    slope,
    intercept,
    slopeError: Math.sqrt(variance / sxx),
    interceptError: Math.sqrt(variance * (1 / n + (meanX * meanX) / sxx)),
    r2: syy > 0 ? 1 - residual / syy : 1,
    count: n,
  }
}
