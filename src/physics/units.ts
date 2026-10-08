/**
 * Centralized unit system.
 *
 * The physics engine works exclusively in SI base units:
 *   length  -> metres
 *   angle   -> radians
 *
 * Every conversion to or from a display unit goes through this module.
 */

export const LENGTH_UNITS = {
  m: 1,
  cm: 1e-2,
  mm: 1e-3,
  um: 1e-6,
  nm: 1e-9,
} as const

export type LengthUnit = keyof typeof LENGTH_UNITS

const UNIT_LABELS: Record<LengthUnit, string> = {
  m: 'm',
  cm: 'cm',
  mm: 'mm',
  um: 'µm',
  nm: 'nm',
}

export function toMeters(value: number, unit: LengthUnit): number {
  return value * LENGTH_UNITS[unit]
}

export function fromMeters(meters: number, unit: LengthUnit): number {
  return meters / LENGTH_UNITS[unit]
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * LENGTH_UNITS[from]) / LENGTH_UNITS[to]
}

export const m = (value: number): number => value
export const cm = (value: number): number => toMeters(value, 'cm')
export const mm = (value: number): number => toMeters(value, 'mm')
export const um = (value: number): number => toMeters(value, 'um')
export const nm = (value: number): number => toMeters(value, 'nm')

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

/** Formats a length held in metres for display, e.g. formatLength(0.15, 'cm', 1) -> "15.0 cm". */
export function formatLength(meters: number, unit: LengthUnit, digits = 1): string {
  if (!Number.isFinite(meters)) return meters > 0 ? '+∞' : meters < 0 ? '−∞' : '—'
  return `${formatNumber(fromMeters(meters, unit), digits)} ${UNIT_LABELS[unit]}`
}

export function formatAngle(radians: number, digits = 1): string {
  if (!Number.isFinite(radians)) return '—'
  return `${formatNumber(radToDeg(radians), digits)}°`
}

/** Fixed-point formatting with a typographic minus sign. */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : value < 0 ? '−∞' : '—'
  const text = value.toFixed(digits)
  // Avoid "-0.00".
  const cleaned = Number(text) === 0 ? (0).toFixed(digits) : text
  return cleaned.replace('-', '−')
}
