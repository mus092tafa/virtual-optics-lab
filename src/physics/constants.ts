/**
 * Centralized physical constants and laboratory hardware parameters.
 * All values are SI (metres, kelvin, ...). Nothing in the UI hard-codes these.
 */
import { cm, mm, nm, perMm } from './units'

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

// --- Spherical mirrors -----------------------------------------------------
/** Focal-length magnitudes of the mirrors, f = R/2 (positive: concave, negative: convex). */
export const MIRROR_FOCAL_LENGTHS: readonly number[] = [cm(10), cm(15), cm(20), cm(30)]
export const DEFAULT_MIRROR_APERTURE = mm(40)

// --- Diffraction grating ---------------------------------------------------
/** Line densities of the transmission gratings, lines per metre. */
export const GRATING_LINE_DENSITIES: readonly number[] = [perMm(100), perMm(300), perMm(600)]
/** Open fraction a/d of one grating period (amplitude grating). */
export const GRATING_OPEN_FRACTION = 0.3
/** Width of the ruled area across the lines. */
export const GRATING_APERTURE = mm(10)
/** Orders beyond this are not evaluated; their efficiency is negligible. */
export const GRATING_MAX_ORDER = 12

// --- Circular aperture -----------------------------------------------------
export const DEFAULT_PINHOLE_DIAMETER = mm(0.2)

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

// --- Schematic eye ---------------------------------------------------------
/**
 * The Gullstrand–Emsley schematic eye (H. H. Emsley, Visual Optics, 1936): one
 * corneal surface and a lens with two, relaxed and accommodated by 8.6 D.
 * Radii are positive when the centre of curvature lies behind the surface.
 */
export const EYE = {
  /** Aqueous and vitreous humour. */
  humourIndex: 4 / 3,
  lensIndex: 1.416,
  cornealRadius: mm(7.8),
  relaxed: { chamberDepth: mm(3.6), frontRadius: mm(10), backRadius: -mm(6), thickness: mm(3.6) },
  accommodated: { chamberDepth: mm(3.2), frontRadius: mm(5), backRadius: -mm(5), thickness: mm(4) },
} as const

/** Hofstetter's average amplitude of accommodation, A = 18.5 − 0.30 × age (dioptres, age in years). */
export const HOFSTETTER_AVERAGE = { atBirth: 18.5, perYear: 0.3 } as const

/** Ranges the eye apparatus offers; the model is not used outside them. */
export const EYE_RANGES = {
  axialLength: { min: mm(21), max: mm(27) },
  cornealRadius: { min: mm(7), max: mm(8.6) },
  age: { min: 15, max: 75 },
  pupilDiameter: { min: mm(2), max: mm(8) },
  objectDistance: { min: cm(5), max: cm(600) },
  vertexDistance: { min: 0, max: mm(16) },
  /** Dioptres. */
  glassesPower: { min: -10, max: 10, step: 0.25 },
} as const

/** Sizes used only to draw the eye; they enter no calculation. */
export const EYE_ANATOMY = {
  /** Half the diameter of the cornea, where it meets the sclera. */
  corneaHalfHeight: mm(5.8),
  /** Half the vertical diameter of the eyeball. */
  globeHalfHeight: mm(12),
  /** Half the height of a spectacle lens. */
  glassesHalfHeight: mm(9),
} as const

/** Further ranges of the eye apparatus: the astigmatic cornea, cylinder glasses, the light and the surface shapes. */
export const EYE_ABERRATION_RANGES = {
  /** Dioptres. */
  glassesCylinder: { min: -6, max: 6, step: 0.25 },
  /** Wavelength of monochromatic light on the chart. */
  wavelength: { min: nm(400), max: nm(700) },
  cornealAsphericity: { min: -1, max: 0.5, step: 0.01 },
  lensAsphericity: { min: -6, max: 1, step: 0.05 },
  /** Inner radius of the ring stop as a fraction of the pupil's radius. */
  pupilZone: { min: 0, max: 0.95, step: 0.05 },
} as const

/** Wavelength at which the schematic eye's indices hold (sodium D). */
export const EYE_REFERENCE_WAVELENGTH = nm(589)
/** The blue and red hydrogen lines between which the chromatic difference of refraction is quoted. */
export const CHROMATIC_LINES = { blue: nm(486), red: nm(656) } as const
/**
 * Index of the chromatic eye, n(λ) = a + b/(λ − c) (L. N. Thibos, M. Ye, X. Zhang, A. Bradley, "The chromatic eye",
 * Applied Optics 31, 3594, 1992). b and c in metres.
 */
export const CHROMATIC_EYE = { a: 1.320535, b: 0.004685e-6, c: 0.214102e-6 } as const
/** Colour temperature of the white light on the chart. */
export const EYE_WHITE_TEMPERATURE = 6500
/** Spectral bands the white light is divided into. */
export const EYE_WHITE_BANDS = 12

/** Mean asphericity of the human cornea (P. M. Kiely, G. Smith, L. G. Carney, Optica Acta 29, 1027, 1982). */
export const AVERAGE_CORNEAL_ASPHERICITY = -0.26
/**
 * Longitudinal spherical aberration of the average eye for a distant ray entering at the given height: 1.0 D at 3 mm,
 * from the mean Z₄⁰ = 0.138 µm over a 5.7 mm pupil (J. Porter et al., J. Opt. Soc. Am. A 18, 1793, 2001).
 */
export const AVERAGE_SPHERICAL_ABERRATION = { longitudinal: 1, rayHeight: mm(3) } as const
/** Zones of equal area the pupil is divided into when real rays are traced. */
export const PUPIL_ZONES = 24
/** Corneal astigmatism of the astigmatism condition, dioptres (the vertical meridian is the steeper one). */
export const CONDITION_ASTIGMATISM = 2

export const DEFAULT_VERTEX_DISTANCE = mm(12)
/** A letter of a test chart is five strokes high. */
export const LETTER_STROKES = 5
/** Blur-disc diameter over stroke width at which a chart stops being sharp, slightly blurred, blurred. */
export const SHARPNESS_LIMITS = [0.25, 1, 3] as const

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
