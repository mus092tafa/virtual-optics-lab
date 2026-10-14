/**
 * Refractive indices of the eye's media as a function of wavelength.
 *
 * Every medium is given the dispersion of the chromatic eye: its refractivity
 * n − 1 at 589 nm, where the schematic eye's indices hold, is scaled by
 * s(λ) = (n_c(λ) − 1)/(n_c(589 nm) − 1). See docs/PHYSICS.md, "Chromatic
 * aberration of the eye".
 */
import { CHROMATIC_EYE, EYE, EYE_REFERENCE_WAVELENGTH } from './constants'

/** Indices of the aqueous and vitreous humour and of the lens. */
export interface Media {
  humour: number
  lens: number
}

/** The schematic eye as published: its indices at 589 nm. */
export const REFERENCE_MEDIA: Media = { humour: EYE.humourIndex, lens: EYE.lensIndex }

/** Index of the chromatic eye, n_c(λ) = a + b/(λ − c). */
export function chromaticEyeIndex(wavelength: number): number {
  return CHROMATIC_EYE.a + CHROMATIC_EYE.b / (wavelength - CHROMATIC_EYE.c)
}

/** s(λ): the refractivity of the eye's media relative to 589 nm. */
export function refractivityScale(wavelength: number): number {
  return (chromaticEyeIndex(wavelength) - 1) / (chromaticEyeIndex(EYE_REFERENCE_WAVELENGTH) - 1)
}

/** The indices of the eye at a wavelength. */
export function mediaAt(wavelength: number): Media {
  const scale = refractivityScale(wavelength)
  return { humour: 1 + (EYE.humourIndex - 1) * scale, lens: 1 + (EYE.lensIndex - 1) * scale }
}
