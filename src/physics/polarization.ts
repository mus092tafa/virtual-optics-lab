/**
 * Polarisation of light passing ideal linear polarisers.
 *
 *   unpolarised light:  half the power is transmitted, polarised along the axis
 *   polarised light:    I = I₀ cos²θ  (Malus's law), θ between polarisation and axis
 *
 * Angles are in radians, measured from the vertical.
 */

export type PolarizationState = { kind: 'unpolarized' } | { kind: 'linear'; angle: number }

export const UNPOLARIZED: PolarizationState = { kind: 'unpolarized' }

/** Malus's law: transmitted fraction for an angle θ between polarisation and axis. */
export function malusTransmission(theta: number): number {
  const cosine = Math.cos(theta)
  return cosine * cosine
}

/** Fraction of the power transmitted by one ideal polariser. */
export function polarizerTransmission(state: PolarizationState, axis: number): number {
  return state.kind === 'unpolarized' ? 0.5 : malusTransmission(axis - state.angle)
}

export interface PolarizerChain {
  /** Fraction of the source power that leaves the last polariser. */
  transmission: number
  /** Cumulative fraction after each polariser, in the order the light meets them. */
  stages: number[]
  state: PolarizationState
}

/** Light passing a sequence of polarisers with the given transmission axes. */
export function polarizerChain(axes: readonly number[], initial: PolarizationState = UNPOLARIZED): PolarizerChain {
  let state = initial
  let transmission = 1
  const stages: number[] = []
  for (const axis of axes) {
    transmission *= polarizerTransmission(state, axis)
    state = { kind: 'linear', angle: axis }
    stages.push(transmission)
  }
  return { transmission, stages, state }
}
