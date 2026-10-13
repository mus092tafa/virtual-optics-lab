/**
 * Spectacle lenses: a thin lens in air at the vertex distance d in front of
 * the cornea. All quantities are vergences in dioptres (1/m): the vergence of
 * light converging to, or diverging from, a point at the signed distance l is
 * L = 1/l, negative for light diverging from a real object.
 */

export interface Glasses {
  /** Power Fs in dioptres; negative for a diverging (concave) lens. */
  power: number
  /** Distance from the lens to the cornea. */
  vertexDistance: number
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
