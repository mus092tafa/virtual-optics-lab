/**
 * Dispersion: refractive index of optical glass as a function of wavelength,
 * from the three-term Sellmeier equation
 *
 *   n²(λ) = 1 + Σᵢ Bᵢ λ² / (λ² − Cᵢ)        (λ in micrometres, Cᵢ in µm²)
 *
 * Coefficients are the published catalogue values (Schott for BK7, F2 and
 * SF10; Malitson 1965 for fused silica), valid across the visible spectrum.
 */
import { fromMeters } from './units'

export interface OpticalGlass {
  id: string
  name: string
  B: readonly [number, number, number]
  /** µm² */
  C: readonly [number, number, number]
}

export const OPTICAL_GLASSES: readonly OpticalGlass[] = [
  {
    id: 'bk7',
    name: 'Crown glass (BK7)',
    B: [1.03961212, 0.231792344, 1.01046945],
    C: [0.00600069867, 0.0200179144, 103.560653],
  },
  {
    id: 'f2',
    name: 'Flint glass (F2)',
    B: [1.34533359, 0.209073176, 0.937357162],
    C: [0.00997743871, 0.0470450767, 111.886764],
  },
  {
    id: 'sf10',
    name: 'Dense flint glass (SF10)',
    B: [1.62153902, 0.256287842, 1.64447552],
    C: [0.0122241457, 0.0595736775, 147.468793],
  },
  {
    id: 'silica',
    name: 'Fused silica',
    B: [0.6961663, 0.4079426, 0.8974794],
    C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2],
  },
]

export function opticalGlass(id: string): OpticalGlass {
  return OPTICAL_GLASSES.find((glass) => glass.id === id) ?? OPTICAL_GLASSES[0]
}

/** Refractive index of a glass at the given vacuum wavelength (metres). */
export function refractiveIndex(glass: OpticalGlass, wavelength: number): number {
  const lambda = fromMeters(wavelength, 'um')
  const square = lambda * lambda
  let sum = 1
  for (let i = 0; i < 3; i++) sum += (glass.B[i] * square) / (square - glass.C[i])
  return Math.sqrt(sum)
}

/** Abbe number V_d = (n_d − 1) / (n_F − n_C): a measure of how weakly a glass disperses. */
export function abbeNumber(glass: OpticalGlass): number {
  const nd = refractiveIndex(glass, 587.5618e-9)
  const nF = refractiveIndex(glass, 486.1327e-9)
  const nC = refractiveIndex(glass, 656.2725e-9)
  return (nd - 1) / (nF - nC)
}
