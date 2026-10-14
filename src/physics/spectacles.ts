/**
 * Spectacle lenses: a thin lens in air at the vertex distance d in front of
 * the cornea. All quantities are vergences in dioptres (1/m): the vergence of
 * light converging to, or diverging from, a point at the signed distance l is
 * L = 1/l, negative for light diverging from a real object.
 */

import { UNIT, add2, inverse2, mul2, powerMatrix, scale2, spheroCylinder } from './astigmatism'
import type { Mat2, SpheroCylinder } from './astigmatism'

export interface Glasses {
  /** Power Fs in dioptres; negative for a diverging (concave) lens. With a cylinder, the power along its axis. */
  power: number
  /** Distance from the lens to the cornea. */
  vertexDistance: number
  /** Power added in the meridian at right angles to the axis; none when absent. */
  cylinder?: number
  /** Axis of the cylinder, radians counter-clockwise from the horizontal as seen facing the eye. */
  axis?: number
}

/** The glasses as written in a prescription. */
export function prescriptionOf(glasses: Glasses): SpheroCylinder {
  return { sphere: glasses.power, cylinder: glasses.cylinder ?? 0, axis: glasses.axis ?? 0 }
}

/** True when the glasses have the same power in every meridian. */
export function isSpherical(glasses: Glasses | null): boolean {
  return !glasses || !glasses.cylinder
}

/** Vergence of the light from an object the given distance in front of a plane (0 for a distant object). */
export function objectVergence(distance: number): number {
  return Number.isFinite(distance) ? -1 / distance : 0
}

/** The vergence a distance d further along the light: L₂ = L₁ / (1 − d L₁). */
export function propagateVergence(vergence: number, distance: number): number {
  return vergence / (1 - distance * vergence)
}

/** Vergence reaching the cornea when light of vergence L meets the glasses: L′ = L + Fs, then across d. */
export function vergenceAtCornea(vergenceAtGlasses: number, glasses: Glasses): number {
  return propagateVergence(vergenceAtGlasses + glasses.power, glasses.vertexDistance)
}

/** The vergence that must meet the glasses for the cornea to receive a wanted one (the inverse of the above). */
export function vergenceAtGlassesFor(wantedAtCornea: number, glasses: Glasses): number {
  return propagateVergence(wantedAtCornea, -glasses.vertexDistance) - glasses.power
}

/**
 * Power that fully corrects the refractive error K: the lens whose second
 * focal point is the eye's far point, Fs = K / (1 + d K).
 */
export function correctingPower(refractiveError: number, vertexDistance: number): number {
  return refractiveError / (1 + vertexDistance * refractiveError)
}

/** Refractive error of an eye that a lens of power Fs at d corrects for a distant object: K = Fs / (1 − d Fs). */
export function refractiveErrorFromPower(power: number, vertexDistance: number): number {
  return propagateVergence(power, vertexDistance)
}

/** The vergence matrix a distance d further along the light: L₂ = L₁ (1 − d L₁)⁻¹. */
export function propagateVergenceMatrix(vergence: Mat2, distance: number): Mat2 {
  return mul2(vergence, inverse2(add2(UNIT, scale2(vergence, -distance))))
}

/** Vergence matrix reaching the cornea when light of vergence L from an object point meets the glasses. */
export function vergenceMatrixAtCornea(vergenceAtGlasses: number, glasses: Glasses): Mat2 {
  return propagateVergenceMatrix(add2(scale2(UNIT, vergenceAtGlasses), powerMatrix(prescriptionOf(glasses))), glasses.vertexDistance)
}

/**
 * The lens that fully corrects a refractive error given as a matrix K: F = K (1 + d K)⁻¹, which is Fs = K/(1 + dK)
 * in each principal meridian.
 */
export function correctingLens(refraction: Mat2, vertexDistance: number): SpheroCylinder {
  return spheroCylinder(mul2(refraction, inverse2(add2(UNIT, scale2(refraction, vertexDistance)))))
}

/** Refraction at the cornea of an eye that a lens at d corrects for a distant object: K = F (1 − d F)⁻¹. */
export function refractionFromLens(lens: SpheroCylinder, vertexDistance: number): SpheroCylinder {
  return spheroCylinder(propagateVergenceMatrix(powerMatrix(lens), vertexDistance))
}
