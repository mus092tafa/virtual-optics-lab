/**
 * Centralized physical constants and laboratory hardware parameters.
 * All values are SI (metres, kelvin, ...). Nothing in the UI hard-codes these.
 */
import { cm, mm, nm } from './units'

// --- Fundamental constants -------------------------------------------------
export const PLANCK_CONSTANT = 6.62607015e-34 // J s
export const SPEED_OF_LIGHT = 2.99792458e8 // m/s
export const BOLTZMANN_CONSTANT = 1.380649e-23 // J/K

// --- He-Ne laser -----------------------------------------------------------
export interface LaserLine {
  id: string
  label: string
  wavelength: number
}

/** Real He-Ne emission lines. The red 632.8 nm line is the standard laboratory laser. */
export const HENE_LINES: readonly LaserLine[] = [
  { id: 'red', label: 'Red 632.8 nm', wavelength: nm(632.8) },
  { id: 'orange', label: 'Orange 611.9 nm', wavelength: nm(611.9) },
  { id: 'yellow', label: 'Yellow 594.1 nm', wavelength: nm(594.1) },
  { id: 'green', label: 'Green 543.5 nm', wavelength: nm(543.5) },
]

export const HENE_WAVELENGTH = nm(632.8)

/**
 * 1/e² intensity radius of the TEM00 beam at the laser output aperture.
 * 0.405 mm gives a full-angle divergence 2λ/(πw₀) ≈ 1.0 mrad, typical of a
 * small laboratory He-Ne tube (0.81 mm beam diameter).
 */
export const HENE_WAIST_RADIUS = mm(0.405)

export function laserLine(id: string): LaserLine {
  return HENE_LINES.find((line) => line.id === id) ?? HENE_LINES[0]
}

// --- Tungsten source -------------------------------------------------------
/** Filament colour temperature of a tungsten-halogen lamp. */
export const TUNGSTEN_TEMPERATURE = 2900 // K
export const VISIBLE_MIN = nm(390)
export const VISIBLE_MAX = nm(730)
/** Representative wavelength used when a single number is needed for white light. */
export const WHITE_LIGHT_REFERENCE_WAVELENGTH = nm(550)

// --- Lenses ----------------------------------------------------------------
export const LENS_FOCAL_LENGTHS: readonly number[] = [cm(5), cm(10), cm(15), cm(20), cm(30)]
export const DEFAULT_LENS_APERTURE = mm(40)

// --- Bench hardware --------------------------------------------------------
export const RAIL_LENGTH = cm(150)
/** Half side length of the square observation screen. */
export const SCREEN_HALF_SIZE = mm(60)
/** Length of a slit along its long axis. */
export const SLIT_LENGTH = mm(10)
/** Carriers cannot be closer than this on the rail. */
export const MIN_COMPONENT_GAP = mm(5)
/** Positions snap to the rail's millimetre scale. */
export const POSITION_SNAP = mm(1)

// --- Michelson interferometer -----------------------------------------------
export const MICHELSON_LASER_TO_LENS = cm(10)
export const MICHELSON_LENS_TO_SPLITTER = cm(10)
/** Focal lengths of the beam-expanding lens. */
export const EXPANDER_FOCAL_LENGTHS: readonly number[] = [cm(1), cm(2), cm(5)]

// --- Refractive indices (sodium D line, 589 nm, 20 °C) ----------------------
export interface Material {
  id: string
  name: string
  n: number
}

export const MATERIALS: readonly Material[] = [
  { id: 'vacuum', name: 'Vacuum', n: 1 },
  { id: 'air', name: 'Air', n: 1.000293 },
  { id: 'water', name: 'Water', n: 1.333 },
  { id: 'ethanol', name: 'Ethanol', n: 1.361 },
  { id: 'acrylic', name: 'Acrylic (PMMA)', n: 1.49 },
  { id: 'crown', name: 'Crown glass (BK7)', n: 1.5168 },
  { id: 'flint', name: 'Flint glass (F2)', n: 1.62 },
  { id: 'sapphire', name: 'Sapphire', n: 1.77 },
  { id: 'diamond', name: 'Diamond', n: 2.417 },
]

export function material(id: string): Material {
  return MATERIALS.find((entry) => entry.id === id) ?? MATERIALS[1]
}
