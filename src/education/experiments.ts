/**
 * The predefined experiments: what the student is asked to do, which
 * quantities they record, and how a recorded measurement is analysed.
 * All analysis formulas come from the physics layer.
 */
import { laserLine } from '../physics/constants'
import { slitWidthFromCentralMaximum } from '../physics/diffraction'
import { wavelengthFromFringeSpacing } from '../physics/interference'
import { focalLengthFromConjugates, magnification } from '../physics/lenses'
import type { BenchSolution } from '../physics/optics'
import { indexFromAngles } from '../physics/refraction'
import type { SurfaceSolution } from '../physics/surface'
import type { BenchComponent } from '../physics/types'
import { cm, degToRad, fromMeters, mm, radToDeg } from '../physics/units'
import type { NotebookResult } from '../state/labState'
import type { ExperimentId } from '../state/presets'

export interface MeasurementField {
  key: string
  label: string
  unit: string
  hint?: string
}

export interface AnalysisContext {
  components: readonly BenchComponent[]
  bench: BenchSolution | null
  surface: SurfaceSolution | null
}

export interface ExperimentDefinition {
  id: ExperimentId
  number: number
  title: string
  short: string
  goal: string
  procedure: string[]
  equations: string[]
  assumptions: string[]
  fields: MeasurementField[]
  /** Quantities the student is told (not to be measured). */
  given(context: AnalysisContext): { label: string; value: string }[]
  analyze(values: Record<string, number>, context: AnalysisContext): NotebookResult[]
}

const result = (label: string, value: number, unit: string, theory: number | null, digits = 2): NotebookResult => ({
  label,
  value,
  unit,
  theory: theory !== null && Number.isFinite(theory) ? theory : null,
  digits,
})

function firstLens(context: AnalysisContext) {
  return context.bench?.imaging?.sequence?.stages[0] ?? null
}

function laserWavelength(context: AnalysisContext): number {
  const source = context.bench?.source
  return laserLine(source?.kind === 'laser' ? source.lineId : 'red').wavelength
}

function lensResults(values: Record<string, number>, context: AnalysisContext): NotebookResult[] {
  const objectDistance = cm(values.do)
  const imageDist = cm(values.di)
  const stage = firstLens(context)
  return [
    result('f = (1/do + 1/di)⁻¹', fromMeters(focalLengthFromConjugates(objectDistance, imageDist), 'cm'), 'cm',
      stage ? fromMeters(stage.focalLength, 'cm') : null),
    result('m = −di/do', magnification(objectDistance, imageDist), '', context.bench?.imaging?.sequence?.magnification ?? null),
  ]
}

const THIN_LENS_ASSUMPTIONS = [
  'Thin lens: thickness is negligible compared with the object and image distances.',
  'Paraxial rays: small angles to the axis, so aberrations are ignored.',
  'Geometric optics: the image is formed by rays; diffraction at the lens aperture is ignored.',
  'Defocus is modelled as a uniform blur disc of diameter c = D·|s − di| / |di| (lens aperture D).',
]

const FRAUNHOFER_ASSUMPTIONS = [
  'Fraunhofer (far-field) diffraction: valid when the Fresnel number N_F = r²/(λL) ≪ 1.',
  'The slit is uniformly illuminated by a coherent wave.',
  'Scalar wave theory; the slit is much longer than it is wide.',
  'The lab reports N_F and warns when the far-field condition fails; a Fresnel model is available.',
]

export const EXPERIMENTS: readonly ExperimentDefinition[] = [
  {
    id: 'reflection',
    number: 1,
    title: 'Law of Reflection',
    short: 'Reflection',
    goal: 'Verify that the angle of reflection equals the angle of incidence, θr = θi.',
    procedure: [
      'Drag the ray box around the mirror, or tilt the mirror, to set an angle of incidence.',
      'Align the protractor with the normal and read the incident and reflected angles from it.',
      'Record the pair of angles. Repeat for at least five different angles.',
    ],
    equations: ['θr = θi  (both measured from the normal)'],
    assumptions: ['Perfectly flat, specular front-surface mirror.', 'Light is treated as a ray (geometric optics).'],
    fields: [
      { key: 'thetaI', label: 'θi', unit: '°' },
      { key: 'thetaR', label: 'θr', unit: '°' },
    ],
    given: () => [],
    analyze: (values, context) => [
      result('θi', values.thetaI, '°', context.surface ? radToDeg(context.surface.incidentAngle) : null, 1),
      result('θr', values.thetaR, '°', context.surface?.reflectedAngle != null ? radToDeg(context.surface.reflectedAngle) : null, 1),
      result('θr − θi', values.thetaR - values.thetaI, '°', 0, 1),
    ],
  },
  {
    id: 'refraction',
    number: 2,
    title: "Refraction — Snell's Law",
    short: 'Refraction',
    goal: "Verify Snell's law, n₁ sin θ₁ = n₂ sin θ₂, and determine the refractive index of the second medium.",
    procedure: [
      'Choose the two media. Set an angle of incidence by dragging the ray box.',
      'Read θ₁ (incident) and θ₂ (refracted) from the protractor, both measured from the normal.',
      'Record the pair. The notebook computes n₂ from your angles.',
      'Move the ray box into the denser medium to observe total internal reflection.',
    ],
    equations: ['n₁ sin θ₁ = n₂ sin θ₂', 'θc = sin⁻¹(n₂/n₁)  for n₁ > n₂', 'R, T from the Fresnel equations'],
    assumptions: [
      'Homogeneous, isotropic, transparent media with a flat interface.',
      'Refractive indices at the sodium D line (589 nm); dispersion is ignored.',
      'Reflected and transmitted power follow the Fresnel equations for unpolarised light.',
    ],
    fields: [
      { key: 'theta1', label: 'θ₁', unit: '°' },
      { key: 'theta2', label: 'θ₂', unit: '°' },
    ],
    given: (context) => (context.surface ? [{ label: 'n₁ (incident medium)', value: context.surface.nIncident.toFixed(4) }] : []),
    analyze: (values, context) => {
      const n1 = context.surface?.nIncident ?? 1
      return [
        result('n₂ = n₁ sinθ₁ / sinθ₂', indexFromAngles(n1, degToRad(values.theta1), degToRad(values.theta2)), '',
          context.surface?.nTransmitted ?? null, 3),
        result('θ₂', values.theta2, '°', context.surface?.refractedAngle != null ? radToDeg(context.surface.refractedAngle) : null, 1),
      ]
    },
  },
  {
    id: 'convex-lens',
    number: 3,
    title: 'Convex Lens — Focal Length',
    short: 'Convex Lens',
    goal: 'Determine the focal length of a convex lens from object and image distances, and study image formation.',
    procedure: [
      'Place the object beyond the focal length of the lens.',
      'Slide the screen along the rail until the image is sharpest.',
      'Read the object–lens distance do and lens–screen distance di from the rail scale and record them.',
      'Repeat for several object positions. In experiment mode, try "Use unknown lens".',
    ],
    equations: ['1/f = 1/do + 1/di', 'm = hi/ho = −di/do'],
    assumptions: THIN_LENS_ASSUMPTIONS,
    fields: [
      { key: 'do', label: 'do', unit: 'cm', hint: 'object → lens' },
      { key: 'di', label: 'di', unit: 'cm', hint: 'lens → sharp image' },
    ],
    given: () => [],
    analyze: lensResults,
  },
  {
    id: 'magnification',
    number: 4,
    title: 'Lens Magnification',
    short: 'Magnification',
    goal: 'Study how the size and orientation of the image depend on the object position.',
    procedure: [
      'Focus the image on the screen.',
      'Measure the image height on the screen (drag across the image). Enter it as negative if the image is inverted.',
      'Record ho, hi, do and di; compare hi/ho with −di/do.',
      'Move the object and repeat: beyond 2f, at 2f, and between f and 2f.',
    ],
    equations: ['m = hi/ho = −di/do', 'm < 0: inverted   |m| > 1: magnified   |m| < 1: reduced'],
    assumptions: THIN_LENS_ASSUMPTIONS,
    fields: [
      { key: 'ho', label: 'ho', unit: 'mm' },
      { key: 'hi', label: 'hi', unit: 'mm', hint: 'negative if inverted' },
      { key: 'do', label: 'do', unit: 'cm' },
      { key: 'di', label: 'di', unit: 'cm' },
    ],
    given: (context) =>
      context.bench?.imaging ? [{ label: 'Object height ho', value: `${fromMeters(context.bench.imaging.objectHeight, 'mm').toFixed(1)} mm` }] : [],
    analyze: (values, context) => {
      const theory = context.bench?.imaging?.sequence?.magnification ?? null
      return [
        result('m = hi/ho', mm(values.hi) / mm(values.ho), '', theory),
        result('m = −di/do', magnification(cm(values.do), cm(values.di)), '', theory),
      ]
    },
  },
  {
    id: 'hene-lens',
    number: 5,
    title: 'He-Ne Laser Through a Lens',
    short: 'He-Ne + Lens',
    goal: 'Study how a laser beam propagates and how a lens focuses it.',
    procedure: [
      'Observe the size of the laser spot on the screen at several distances with no lens.',
      'Insert a lens and move the screen to find where the spot is smallest (the beam waist).',
      'Record the lens-to-waist distance; it lies very close to the focal length.',
      'Add a second lens to build a beam expander (f₁ + f₂ apart).',
    ],
    equations: ['w(z) = w₀ √(1 + (z/z_R)²)', 'z_R = π w₀² / λ', 'θ = λ / (π w₀)', 'q′ = q + d;   1/q′ = 1/q − 1/f'],
    assumptions: [
      'TEM₀₀ Gaussian beam, λ = 632.8 nm, waist radius w₀ = 0.405 mm at the laser output (≈1 mrad full divergence).',
      'Paraxial propagation with the complex beam parameter q; lenses are thin and do not clip the beam.',
      'The beam is drawn at its 1/e² intensity radius.',
    ],
    fields: [{ key: 'focus', label: 'lens → smallest spot', unit: 'cm' }],
    given: (context) => [{ label: 'Wavelength λ', value: `${fromMeters(laserWavelength(context), 'nm').toFixed(1)} nm` }],
    analyze: (values, context) => {
      const lens = context.components.find((c) => c.kind === 'lens')
      const waist = context.bench?.beam?.path.waists.find((w) => lens && w.x > lens.x)
      return [
        result('f ≈ focus distance', values.focus, 'cm', lens && lens.kind === 'lens' ? fromMeters(lens.focalLength, 'cm') : null),
        result('waist position', values.focus, 'cm', lens && waist ? fromMeters(waist.x - lens.x, 'cm') : null),
      ]
    },
  },
  {
    id: 'single-slit',
    number: 6,
    title: 'Single-Slit Diffraction',
    short: 'Single Slit',
    goal: 'Relate the width of the diffraction pattern to the wavelength and the slit width.',
    procedure: [
      'Read the slit-to-screen distance L from the rail.',
      'On the screen, measure the full width W of the central maximum (between the first dark bands on either side).',
      'Record L and W; the notebook computes the slit width a = 2λL/W.',
      'Change the slit width and observe that a narrower slit gives a wider pattern.',
    ],
    equations: ['I(θ) = I₀ [sin β / β]²,   β = π a sin θ / λ', 'minima: a sin θ = mλ', 'W ≈ 2λL / a'],
    assumptions: FRAUNHOFER_ASSUMPTIONS,
    fields: [
      { key: 'L', label: 'L', unit: 'cm', hint: 'slit → screen' },
      { key: 'W', label: 'W', unit: 'mm', hint: 'central maximum, full width' },
    ],
    given: (context) => [{ label: 'Wavelength λ', value: `${fromMeters(laserWavelength(context), 'nm').toFixed(1)} nm` }],
    analyze: (values, context) => [
      result('a = 2λL / W', fromMeters(slitWidthFromCentralMaximum(mm(values.W), laserWavelength(context), cm(values.L)), 'mm'), 'mm',
        context.bench?.diffraction ? fromMeters(context.bench.diffraction.slitWidth, 'mm') : null, 3),
    ],
  },
  {
    id: 'double-slit',
    number: 7,
    title: 'Double-Slit Interference',
    short: 'Double Slit',
    goal: 'Measure the wavelength of the laser from the spacing of the interference fringes.',
    procedure: [
      'Read the slit-to-screen distance L from the rail.',
      'On the screen, measure the distance across several bright fringes and divide by the number of spacings to get Δy.',
      'Record L and Δy; the notebook computes λ = Δy·d / L.',
      'Change the slit separation and the slit width, and observe the fringes and the envelope separately.',
    ],
    equations: ['I(θ) = I₀ [sin β / β]² cos² δ', 'β = π a sin θ / λ,   δ = π d sin θ / λ', 'Δy = λL / d'],
    assumptions: FRAUNHOFER_ASSUMPTIONS,
    fields: [
      { key: 'L', label: 'L', unit: 'cm', hint: 'slits → screen' },
      { key: 'dy', label: 'Δy', unit: 'mm', hint: 'fringe spacing' },
    ],
    given: (context) => {
      const separation = context.bench?.diffraction?.separation
      return separation ? [{ label: 'Slit separation d', value: `${fromMeters(separation, 'mm').toFixed(3)} mm` }] : []
    },
    analyze: (values, context) => {
      const separation = context.bench?.diffraction?.separation ?? mm(0.25)
      return [
        result('λ = Δy·d / L', fromMeters(wavelengthFromFringeSpacing(mm(values.dy), separation, cm(values.L)), 'nm'), 'nm',
          fromMeters(laserWavelength(context), 'nm'), 1),
      ]
    },
  },
  {
    id: 'tungsten',
    number: 8,
    title: 'Tungsten Light Source',
    short: 'Tungsten + Lens',
    goal: 'Study how a broadband, extended source behaves in an optical system and how its intensity affects the observed output.',
    procedure: [
      'Focus the image of the object on the screen and record do and di.',
      'Change the lamp intensity: the image brightness changes, its position and size do not.',
      'Remove the object: the lens now images the lamp aperture itself.',
      'Replace the object by a double slit: white-light fringes are coloured and wash out for a large source.',
    ],
    equations: ['1/f = 1/do + 1/di', 'E_image ∝ L · π D² / (4 s²)  (L: source radiance)', 'B_λ(T): Planck spectrum, T = 2900 K'],
    assumptions: [
      ...THIN_LENS_ASSUMPTIONS,
      'The lamp is a 2900 K black-body radiator with a finite emitting aperture; its spectrum is fixed while the intensity is varied.',
      'The object is a uniformly back-lit diffusing target.',
    ],
    fields: [
      { key: 'intensity', label: 'Lamp', unit: '%' },
      { key: 'do', label: 'do', unit: 'cm' },
      { key: 'di', label: 'di', unit: 'cm' },
    ],
    given: () => [],
    analyze: lensResults,
  },
]

export function experiment(id: ExperimentId): ExperimentDefinition {
  return EXPERIMENTS.find((entry) => entry.id === id) ?? EXPERIMENTS[0]
}
