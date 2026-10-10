/**
 * The predefined experiments: what the student is asked to do, which
 * quantities they record, and how a recorded measurement is analysed.
 * All analysis formulas come from the physics layer.
 */
import { apertureFromDarkRing } from '../physics/airy'
import { laserLine } from '../physics/constants'
import { slitWidthFromCentralMaximum } from '../physics/diffraction'
import { wavelengthFromOrder } from '../physics/grating'
import { wavelengthFromFringeSpacing } from '../physics/interference'
import { focalLengthFromConjugates, magnification } from '../physics/lenses'
import { wavelengthFromFringeCount } from '../physics/michelson'
import type { MichelsonSolution } from '../physics/michelson'
import type { BenchSolution } from '../physics/optics'
import { malusTransmission } from '../physics/polarization'
import { indexFromMinimumDeviation } from '../physics/prism'
import { indexFromAngles, indexFromBrewsterAngle } from '../physics/refraction'
import type { SurfaceSolution } from '../physics/surface'
import type { BenchComponent } from '../physics/types'
import { cm, degToRad, formatNumber, fromMeters, mm, perMm, radToDeg, toPerMm, um } from '../physics/units'
import type { LinearFit } from './fit'
import type { NotebookResult } from '../state/labState'
import type { ExperimentId } from '../state/presets'

export interface MeasurementField {
  key: string
  label: string
  unit: string
  hint?: string
  /**
   * Reading uncertainty of the instrument, in the unit of the field: half a
   * scale division for a direct reading, a whole division for a difference of
   * two readings. The student can change it before recording.
   */
  uncertainty: number
}

/** The prism on the spectrometer table, as the notebook needs it. */
export interface PrismContext {
  apexAngle: number
  wavelength: number
  /** Refractive index of the glass at that wavelength. */
  index: number
}

export interface AnalysisContext {
  components: readonly BenchComponent[]
  bench: BenchSolution | null
  surface: SurfaceSolution | null
  michelson: MichelsonSolution | null
  prism: PrismContext | null
}

/** Straight-line graph of the recorded rows, from which a quantity is read off the slope or intercept. */
export interface PlotDefinition {
  xLabel: string
  yLabel: string
  /** The relation being tested, shown under the graph. */
  relation: string
  /** Linearised coordinates of one recorded row; null when the row cannot be plotted. */
  point(values: Record<string, number>, context: AnalysisContext): { x: number; y: number } | null
  /** Physical quantities that follow from the fitted line. */
  interpret(fit: LinearFit, context: AnalysisContext): NotebookResult[]
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
  /** Present when the measurements lie on a straight line in suitable variables. */
  plot?: PlotDefinition
  /** Quantities the student is told (not to be measured). */
  given(context: AnalysisContext): { label: string; value: string }[]
  analyze(values: Record<string, number>, context: AnalysisContext): NotebookResult[]
}

const result = (
  label: string,
  value: number,
  unit: string,
  theory: number | null,
  digits = 2,
  uncertainty: number | null = null,
): NotebookResult => ({
  label,
  value,
  unit,
  theory: theory !== null && Number.isFinite(theory) ? theory : null,
  digits,
  uncertainty,
})

/** Marks a result that changes with the setting, so that it is left out of the mean over the rows. */
const perSetting = (entry: NotebookResult): NotebookResult => ({ ...entry, perSetting: true })

/** A quantity q = scale / fitted value, with the uncertainty that follows from the standard error. */
const reciprocal = (label: string, fitted: number, error: number, unit: string, theory: number | null, digits = 2, scale = 1) =>
  result(label, scale / fitted, unit, theory, digits, Math.abs((scale * error) / (fitted * fitted)))

/** A quantity q = scale × fitted value. */
const scaled = (label: string, fitted: number, error: number, unit: string, theory: number | null, digits = 2, scale = 1) =>
  result(label, scale * fitted, unit, theory, digits, Math.abs(scale * error))

/** 1/di against 1/do: a line of slope −1 whose intercept is 1/f. */
const conjugatePlot: PlotDefinition = {
  xLabel: '1/do (cm⁻¹)',
  yLabel: '1/di (cm⁻¹)',
  relation: '1/di = 1/f − 1/do: slope −1, intercept 1/f',
  point: (values) => (values.do !== 0 && values.di !== 0 ? { x: 1 / values.do, y: 1 / values.di } : null),
  interpret: (fit, context) => {
    const stage = firstLens(context)
    return [
      reciprocal('f = 1 / intercept', fit.intercept, fit.interceptError, 'cm', stage ? fromMeters(stage.focalLength, 'cm') : null),
      scaled('slope', fit.slope, fit.slopeError, '', -1, 3),
    ]
  },
}

function firstLens(context: AnalysisContext) {
  return context.bench?.imaging?.sequence?.stages[0] ?? null
}

function laserWavelength(context: AnalysisContext): number {
  const source = context.bench?.source
  return laserLine(source?.kind === 'laser' ? source.lineId : 'red').wavelength
}

function concaveFocalLength(context: AnalysisContext): number | null {
  const lens = context.components.find((c) => c.kind === 'lens' && c.focalLength < 0)
  return lens && lens.kind === 'lens' ? fromMeters(lens.focalLength, 'cm') : null
}

/** Period of the grating on the bench (300 lines/mm when none is mounted). */
function gratingPeriodOf(context: AnalysisContext): number {
  return context.bench?.grating?.period ?? 1 / perMm(300)
}

function orderAngleOf(context: AnalysisContext, order: number): number | null {
  const entry = context.bench?.grating?.orders.find((o) => o.order === Math.abs(order))
  return entry ? radToDeg(entry.angle) : null
}

function lensResults(values: Record<string, number>, context: AnalysisContext): NotebookResult[] {
  const objectDistance = cm(values.do)
  const imageDist = cm(values.di)
  const stage = firstLens(context)
  return [
    result('f = (1/do + 1/di)⁻¹', fromMeters(focalLengthFromConjugates(objectDistance, imageDist), 'cm'), 'cm',
      stage ? fromMeters(stage.focalLength, 'cm') : null),
    perSetting(result('m = −di/do', magnification(objectDistance, imageDist), '', context.bench?.imaging?.sequence?.magnification ?? null)),
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
      { key: 'thetaI', label: 'θi', unit: '°', uncertainty: 0.5 },
      { key: 'thetaR', label: 'θr', unit: '°', uncertainty: 0.5 },
    ],
    plot: {
      xLabel: 'θi (°)',
      yLabel: 'θr (°)',
      relation: 'θr = θi: slope 1 through the origin',
      point: (values) => ({ x: values.thetaI, y: values.thetaR }),
      interpret: (fit) => [scaled('slope', fit.slope, fit.slopeError, '', 1, 3), scaled('intercept', fit.intercept, fit.interceptError, '°', 0, 2)],
    },
    given: () => [],
    analyze: (values, context) => [
      perSetting(result('θi', values.thetaI, '°', context.surface ? radToDeg(context.surface.incidentAngle) : null, 1)),
      perSetting(result('θr', values.thetaR, '°', context.surface?.reflectedAngle != null ? radToDeg(context.surface.reflectedAngle) : null, 1)),
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
      { key: 'theta1', label: 'θ₁', unit: '°', uncertainty: 0.5 },
      { key: 'theta2', label: 'θ₂', unit: '°', uncertainty: 0.5 },
    ],
    plot: {
      xLabel: 'sin θ₂',
      yLabel: 'sin θ₁',
      relation: 'sin θ₁ = (n₂/n₁) sin θ₂: slope n₂/n₁',
      point: (values) => ({ x: Math.sin(degToRad(values.theta2)), y: Math.sin(degToRad(values.theta1)) }),
      interpret: (fit, context) => {
        const n1 = context.surface?.nIncident ?? 1
        return [scaled('n₂ = n₁ × slope', fit.slope, fit.slopeError, '', context.surface?.nTransmitted ?? null, 3, n1)]
      },
    },
    given: (context) => (context.surface ? [{ label: 'n₁ (incident medium)', value: context.surface.nIncident.toFixed(4) }] : []),
    analyze: (values, context) => {
      const n1 = context.surface?.nIncident ?? 1
      return [
        result('n₂ = n₁ sinθ₁ / sinθ₂', indexFromAngles(n1, degToRad(values.theta1), degToRad(values.theta2)), '',
          context.surface?.nTransmitted ?? null, 3),
        perSetting(result('θ₂', values.theta2, '°', context.surface?.refractedAngle != null ? radToDeg(context.surface.refractedAngle) : null, 1)),
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
      { key: 'do', label: 'do', unit: 'cm', hint: 'object → lens', uncertainty: 0.1 },
      { key: 'di', label: 'di', unit: 'cm', hint: 'lens → sharp image', uncertainty: 0.1 },
    ],
    plot: conjugatePlot,
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
      { key: 'ho', label: 'ho', unit: 'mm', uncertainty: 0.5 },
      { key: 'hi', label: 'hi', unit: 'mm', hint: 'negative if inverted', uncertainty: 0.5 },
      { key: 'do', label: 'do', unit: 'cm', uncertainty: 0.1 },
      { key: 'di', label: 'di', unit: 'cm', uncertainty: 0.1 },
    ],
    plot: {
      xLabel: '−di/do',
      yLabel: 'hi/ho',
      relation: 'hi/ho = −di/do: slope 1 through the origin',
      point: (values) => (values.do !== 0 && values.ho !== 0 ? { x: -values.di / values.do, y: values.hi / values.ho } : null),
      interpret: (fit) => [scaled('slope', fit.slope, fit.slopeError, '', 1, 3)],
    },
    given: (context) =>
      context.bench?.imaging ? [{ label: 'Object height ho', value: `${fromMeters(context.bench.imaging.objectHeight, 'mm').toFixed(1)} mm` }] : [],
    analyze: (values, context) => {
      const theory = context.bench?.imaging?.sequence?.magnification ?? null
      return [
        perSetting(result('m = hi/ho', mm(values.hi) / mm(values.ho), '', theory)),
        perSetting(result('m = −di/do', magnification(cm(values.do), cm(values.di)), '', theory)),
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
    fields: [{ key: 'focus', label: 'lens → smallest spot', unit: 'cm', uncertainty: 0.2 }],
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
      { key: 'L', label: 'L', unit: 'cm', hint: 'slit → screen', uncertainty: 0.1 },
      { key: 'W', label: 'W', unit: 'mm', hint: 'central maximum, full width', uncertainty: 0.2 },
    ],
    plot: {
      xLabel: 'L (cm)',
      yLabel: 'W (mm)',
      relation: 'W = (2λ/a) L: slope 2λ/a',
      point: (values) => ({ x: values.L, y: values.W }),
      interpret: (fit, context) => [
        // The slope is in mm per cm: W/L = 0.1 × slope.
        reciprocal('a = 2λ / slope', mm(fit.slope) / cm(1), mm(fit.slopeError) / cm(1), 'mm',
          context.bench?.diffraction ? fromMeters(context.bench.diffraction.slitWidth, 'mm') : null, 3, fromMeters(2 * laserWavelength(context), 'mm')),
      ],
    },
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
      { key: 'L', label: 'L', unit: 'cm', hint: 'slits → screen', uncertainty: 0.1 },
      { key: 'dy', label: 'Δy', unit: 'mm', hint: 'fringe spacing', uncertainty: 0.05 },
    ],
    plot: {
      xLabel: 'L (cm)',
      yLabel: 'Δy (mm)',
      relation: 'Δy = (λ/d) L: slope λ/d',
      point: (values) => ({ x: values.L, y: values.dy }),
      interpret: (fit, context) => {
        const separation = context.bench?.diffraction?.separation ?? mm(0.25)
        return [
          scaled('λ = d × slope', mm(fit.slope) / cm(1), mm(fit.slopeError) / cm(1), 'nm', fromMeters(laserWavelength(context), 'nm'), 1,
            fromMeters(separation, 'nm')),
        ]
      },
    },
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
      { key: 'intensity', label: 'Lamp', unit: '%', uncertainty: 1 },
      { key: 'do', label: 'do', unit: 'cm', uncertainty: 0.1 },
      { key: 'di', label: 'di', unit: 'cm', uncertainty: 0.1 },
    ],
    plot: conjugatePlot,
    given: () => [],
    analyze: lensResults,
  },
  {
    id: 'michelson',
    number: 9,
    title: 'Michelson Interferometer',
    short: 'Michelson',
    goal: 'Measure the wavelength of the laser by counting the fringes that pass while one mirror is moved.',
    procedure: [
      'With the expander lens in place and the mirrors aligned, observe the circular fringes on the screen.',
      'Tilt mirror M2 slightly and watch the rings turn into curved, then straight fringes.',
      'Re-align the mirrors, note the micrometer reading and reset the fringe counter.',
      'Move M2 slowly (fine control or "Scan") and count the fringes N that pass the centre. Note the mirror travel Δd.',
      'Record Δd and N; the notebook computes λ = 2Δd / N.',
    ],
    equations: [
      'path difference = 2d',
      '2d cos θ = mλ   (circular fringes)',
      'N = 2Δd / λ   (one fringe per λ/2 of mirror travel)',
      'fringe spacing ∝ λ / (2α)   (mirror tilted by α)',
    ],
    assumptions: [
      'Ideal 50/50 beam splitter of negligible thickness (no compensator plate needed); mirrors are perfect.',
      'One beam is reflected at the outside of the splitter coating and the other at the inside, giving a π phase difference: the centre is dark when the arms are equal.',
      'Each arm carries a paraxial Gaussian beam; the expander lens is thin and does not clip the beam.',
      'The laser is perfectly coherent: fringe contrast does not fall as the path difference grows.',
    ],
    fields: [
      { key: 'dd', label: 'Δd', unit: 'µm', hint: 'mirror travel', uncertainty: 0.05 },
      { key: 'N', label: 'N', unit: 'fringes', hint: 'fringes counted', uncertainty: 0.5 },
    ],
    plot: {
      xLabel: 'N (fringes)',
      yLabel: 'Δd (µm)',
      relation: 'Δd = (λ/2) N: slope λ/2',
      point: (values) => ({ x: values.N, y: values.dd }),
      interpret: (fit, context) => [
        scaled('λ = 2 × slope', fit.slope, fit.slopeError, 'nm', context.michelson ? fromMeters(context.michelson.wavelength, 'nm') : null, 1,
          2 * fromMeters(um(1), 'nm')),
      ],
    },
    given: () => [],
    analyze: (values, context) => [
      result('λ = 2Δd / N', fromMeters(wavelengthFromFringeCount(um(values.dd), values.N), 'nm'), 'nm',
        context.michelson ? fromMeters(context.michelson.wavelength, 'nm') : null, 1),
    ],
  },
  {
    id: 'concave-lens',
    number: 10,
    title: 'Concave Lens — Focal Length',
    short: 'Concave Lens',
    goal: 'Determine the focal length of a diverging lens, whose image of a real object is virtual and cannot be caught on a screen.',
    procedure: [
      'Drag the concave lens to the far end of the rail, beyond the screen, so that it is out of the light path.',
      'With the convex lens alone, slide the screen until the image is sharp. Note the screen position P₁.',
      'Put the concave lens between the convex lens and P₁. The light reaching it is converging: P₁ is its virtual object.',
      'Move the screen away until the image is sharp again. Note the new position P₂.',
      'Record s = P₁ − (concave lens position) and di = P₂ − (concave lens position).',
    ],
    equations: ['1/f = 1/do + 1/di   with do = −s  (virtual object)', 'f = (1/di − 1/s)⁻¹', 'f < 0 for a diverging lens'],
    assumptions: [
      ...THIN_LENS_ASSUMPTIONS,
      'Lenses in sequence: the image formed by the first lens is the object of the second, whether or not the light ever reaches it.',
    ],
    fields: [
      { key: 's', label: 's', unit: 'cm', hint: 'concave lens → P₁', uncertainty: 0.1 },
      { key: 'di', label: 'di', unit: 'cm', hint: 'concave lens → P₂', uncertainty: 0.1 },
    ],
    plot: {
      xLabel: '1/s (cm⁻¹)',
      yLabel: '1/di (cm⁻¹)',
      relation: '1/di = 1/f + 1/s: slope 1, intercept 1/f',
      point: (values) => (values.s !== 0 && values.di !== 0 ? { x: 1 / values.s, y: 1 / values.di } : null),
      interpret: (fit, context) => [
        reciprocal('f = 1 / intercept', fit.intercept, fit.interceptError, 'cm', concaveFocalLength(context)),
        scaled('slope', fit.slope, fit.slopeError, '', 1, 3),
      ],
    },
    given: () => [],
    analyze: (values, context) => [
      result('f = (1/di − 1/s)⁻¹', fromMeters(focalLengthFromConjugates(-cm(values.s), cm(values.di)), 'cm'), 'cm', concaveFocalLength(context)),
    ],
  },
  {
    id: 'grating',
    number: 11,
    title: 'Diffraction Grating',
    short: 'Grating',
    goal: 'Measure the wavelength of the laser from the positions of the diffraction orders of a grating.',
    procedure: [
      'Read the grating-to-screen distance L from the rail.',
      'On the screen, measure the distance y from the central (zeroth-order) spot to the spot of order m.',
      'Record L, y and m; the notebook computes λ = d sin θ / m with tan θ = y / L.',
      'Repeat for other orders and distances. The angles are large: tan θ and sin θ must not be confused.',
      'Replace the laser by the tungsten lamp to see each order spread into a spectrum.',
    ],
    equations: ['d sin θ = mλ', 'tan θ = y / L', 'η_m ∝ [sin(π m a/d) / (π m a/d)]²   (order strength)'],
    assumptions: [
      'Light meets the grating at normal incidence.',
      'Thin amplitude grating with open fraction a/d = 0.3; order strengths follow scalar diffraction theory and are approximate for the finest grating.',
      'The laser beam covers many lines, so each order is a deflected copy of the beam.',
      'For the lamp, each wavelength projects the open width of the grating onto the screen; the source is an incoherent disc.',
    ],
    fields: [
      { key: 'L', label: 'L', unit: 'cm', hint: 'grating → screen', uncertainty: 0.1 },
      { key: 'y', label: 'y', unit: 'mm', hint: 'order 0 → order m', uncertainty: 0.2 },
      { key: 'm', label: 'm', unit: 'order', hint: '1, 2, …', uncertainty: 0 },
    ],
    plot: {
      xLabel: 'm',
      yLabel: 'sin θ',
      relation: 'sin θ = (λ/d) m: slope λ/d',
      point: (values) => (values.L > 0 ? { x: values.m, y: Math.sin(Math.atan2(mm(values.y), cm(values.L))) } : null),
      interpret: (fit, context) => [
        scaled('λ = d × slope', fit.slope, fit.slopeError, 'nm', fromMeters(laserWavelength(context), 'nm'), 1, fromMeters(gratingPeriodOf(context), 'nm')),
      ],
    },
    given: (context) => {
      const period = gratingPeriodOf(context)
      return [
        { label: 'Line density', value: `${formatNumber(toPerMm(1 / period), 0)} lines/mm` },
        { label: 'Period d', value: `${formatNumber(fromMeters(period, 'um'), 3)} µm` },
      ]
    },
    analyze: (values, context) => [
      result('λ = d sin θ / m', fromMeters(wavelengthFromOrder(mm(values.y), cm(values.L), values.m, gratingPeriodOf(context)), 'nm'), 'nm',
        fromMeters(laserWavelength(context), 'nm'), 1),
      perSetting(result('θ = tan⁻¹(y/L)', radToDeg(Math.atan2(Math.abs(mm(values.y)), cm(values.L))), '°',
        orderAngleOf(context, values.m), 2)),
    ],
  },
  {
    id: 'airy',
    number: 12,
    title: 'Circular Aperture — Airy Pattern',
    short: 'Circular Aperture',
    goal: 'Determine the diameter of a circular aperture from the size of its diffraction pattern.',
    procedure: [
      'Read the aperture-to-screen distance L from the rail.',
      'Raise the exposure until the first dark ring around the central disc is clear.',
      'Measure the diameter of the first dark ring across the centre of the pattern.',
      'Record L and the ring diameter; the notebook computes D = 2.44 λ L / D_ring.',
      'Change the aperture diameter and observe that a smaller aperture gives a larger pattern.',
    ],
    equations: ['I(θ) = I₀ [2 J₁(x) / x]²,   x = π D sin θ / λ', 'first dark ring: sin θ = 1.22 λ / D', 'D_ring ≈ 2.44 λ L / D'],
    assumptions: [
      'Fraunhofer (far-field) diffraction: valid when the Fresnel number N_F = (D/2)²/(λL) ≪ 1.',
      'The aperture is uniformly illuminated by a coherent wave.',
      'Scalar wave theory; the aperture is a perfect circle in a thin opaque plate.',
      'The lab reports N_F and warns when the far-field condition fails.',
    ],
    fields: [
      { key: 'L', label: 'L', unit: 'cm', hint: 'aperture → screen', uncertainty: 0.1 },
      { key: 'ring', label: 'D_ring', unit: 'mm', hint: 'first dark ring, diameter', uncertainty: 0.1 },
    ],
    plot: {
      xLabel: 'L (cm)',
      yLabel: 'D_ring (mm)',
      relation: 'D_ring = (2.44 λ/D) L: slope 2.44 λ/D',
      point: (values) => ({ x: values.L, y: values.ring }),
      interpret: (fit, context) => [
        reciprocal('D = 2.44 λ / slope', mm(fit.slope) / cm(1), mm(fit.slopeError) / cm(1), 'mm',
          context.bench?.airy ? fromMeters(context.bench.airy.diameter, 'mm') : null, 3,
          fromMeters(apertureFromDarkRing(1, laserWavelength(context), 1), 'mm')),
      ],
    },
    given: (context) => [{ label: 'Wavelength λ', value: `${fromMeters(laserWavelength(context), 'nm').toFixed(1)} nm` }],
    analyze: (values, context) => [
      result('D = 2.44 λL / D_ring', fromMeters(apertureFromDarkRing(mm(values.ring), laserWavelength(context), cm(values.L)), 'mm'), 'mm',
        context.bench?.airy ? fromMeters(context.bench.airy.diameter, 'mm') : null, 3),
    ],
  },
  {
    id: 'malus',
    number: 13,
    title: "Polarisation — Malus's Law",
    short: 'Malus’s Law',
    goal: 'Verify that the light transmitted by an analyser varies as cos²θ with the angle between polariser and analyser.',
    procedure: [
      'Set both polarisers to the same axis angle. Note the detector reading I₀ (relative irradiance at the screen).',
      'Turn the second polariser (the analyser) by θ and note the reading I.',
      'Record θ, I and I₀; the notebook compares I/I₀ with cos²θ.',
      'Repeat in steps of 10° up to 90°, where the polarisers are crossed.',
      'Insert a third polariser at 45° between crossed polarisers and explain why light reappears.',
    ],
    equations: ['I = I₀ cos²θ   (Malus’s law)', 'unpolarised light through one ideal polariser: I = ½ I_source'],
    assumptions: [
      'Ideal linear polarisers: complete extinction across the axis, no absorption along it.',
      'The He-Ne laser and the lamp are taken as unpolarised (a randomly polarised laser tube).',
      'Polarisers change the power only; they do not shift or distort the beam.',
    ],
    fields: [
      { key: 'theta', label: 'θ', unit: '°', hint: 'analyser − polariser', uncertainty: 1 },
      { key: 'I', label: 'I', unit: '%', hint: 'detector reading', uncertainty: 0.1 },
      { key: 'I0', label: 'I₀', unit: '%', hint: 'reading at θ = 0', uncertainty: 0.1 },
    ],
    plot: {
      xLabel: 'cos²θ',
      yLabel: 'I / I₀',
      relation: 'I/I₀ = cos²θ: slope 1 through the origin',
      point: (values) => (values.I0 !== 0 ? { x: malusTransmission(degToRad(values.theta)), y: values.I / values.I0 } : null),
      interpret: (fit) => [scaled('slope', fit.slope, fit.slopeError, '', 1, 3), scaled('intercept', fit.intercept, fit.interceptError, '', 0, 3)],
    },
    given: () => [],
    analyze: (values) => [perSetting(result('I / I₀', values.I / values.I0, '', malusTransmission(degToRad(values.theta)), 3))],
  },
  {
    id: 'brewster',
    number: 14,
    title: "Brewster's Angle",
    short: 'Brewster',
    goal: 'Find the angle of incidence at which reflected p-polarised light vanishes, and determine the refractive index from it.',
    procedure: [
      'Set the polarisation of the ray to p (electric field in the plane of incidence).',
      'Increase the angle of incidence slowly and watch the reflected power reading fall.',
      'Find the angle at which the reflected ray disappears and read it from the protractor: this is θ_B.',
      'Record θ_B; the notebook computes n₂ = n₁ tan θ_B.',
      'Switch to s polarisation and confirm that the reflected ray never vanishes.',
    ],
    equations: [
      'tan θ_B = n₂ / n₁',
      'R_p = [(n₂ cos θ₁ − n₁ cos θ₂) / (n₂ cos θ₁ + n₁ cos θ₂)]²',
      'R_s = [(n₁ cos θ₁ − n₂ cos θ₂) / (n₁ cos θ₁ + n₂ cos θ₂)]²',
      'at θ_B the reflected and refracted rays are perpendicular',
    ],
    assumptions: [
      'Homogeneous, isotropic, non-absorbing media with a flat interface.',
      'Refractive indices at the sodium D line (589 nm); dispersion is ignored.',
      'Fresnel equations for a single interface; no second surface, no coatings.',
    ],
    fields: [{ key: 'thetaB', label: 'θ_B', unit: '°', hint: 'angle of zero reflection', uncertainty: 0.5 }],
    given: (context) => (context.surface ? [{ label: 'n₁ (incident medium)', value: context.surface.nIncident.toFixed(4) }] : []),
    analyze: (values, context) => {
      const n1 = context.surface?.nIncident ?? 1
      return [
        result('n₂ = n₁ tan θ_B', indexFromBrewsterAngle(n1, degToRad(values.thetaB)), '', context.surface?.nTransmitted ?? null, 3),
        result('θ_B', values.thetaB, '°', context.surface?.brewsterAngle != null ? radToDeg(context.surface.brewsterAngle) : null, 1),
      ]
    },
  },
  {
    id: 'prism',
    number: 15,
    title: 'Prism — Minimum Deviation and Dispersion',
    short: 'Prism',
    goal: 'Measure the refractive index of a glass prism by the method of minimum deviation, and observe how it depends on wavelength.',
    procedure: [
      'Choose a laser line. Rotate the prism (change the angle of incidence) and watch the deviation reading δ.',
      'Find the angle at which δ is smallest: the ray then passes symmetrically through the prism.',
      'Record δ_min; the notebook computes n = sin((A + δ_min)/2) / sin(A/2).',
      'Repeat for the other laser lines: the index is larger for shorter wavelengths (dispersion).',
      'Switch to white light to see the spectrum; reduce the angle of incidence until the ray is totally reflected inside.',
    ],
    equations: [
      'sin θ₁ = n sin θ₁′     n sin θ₂′ = sin θ₂',
      'θ₁′ + θ₂′ = A',
      'δ = θ₁ + θ₂ − A',
      'n = sin((A + δ_min)/2) / sin(A/2)',
      'n²(λ) = 1 + Σ Bᵢ λ² / (λ² − Cᵢ)   (Sellmeier)',
    ],
    assumptions: [
      'The prism stands in air; its faces are flat and its glass homogeneous.',
      'Refractive index from the Sellmeier equation of the glass at the wavelength of the ray.',
      'A single ray: the finite width of the beam and multiple internal reflections are ignored.',
      'Transmitted power from the Fresnel equations for unpolarised light at both faces.',
    ],
    fields: [{ key: 'dmin', label: 'δ_min', unit: '°', hint: 'smallest deviation', uncertainty: 0.05 }],
    given: (context) =>
      context.prism
        ? [
            { label: 'Apex angle A', value: `${radToDeg(context.prism.apexAngle).toFixed(1)}°` },
            { label: 'Wavelength λ', value: `${fromMeters(context.prism.wavelength, 'nm').toFixed(1)} nm` },
          ]
        : [],
    analyze: (values, context) => [
      result('n = sin((A + δ_min)/2) / sin(A/2)', indexFromMinimumDeviation(context.prism?.apexAngle ?? degToRad(60), degToRad(values.dmin)), '',
        context.prism?.index ?? null, 4),
    ],
  },
  {
    id: 'concave-mirror',
    number: 16,
    title: 'Concave Mirror — Focal Length',
    short: 'Concave Mirror',
    goal: 'Determine the focal length and radius of curvature of a concave mirror from object and image distances.',
    procedure: [
      'Place the object beyond the focal point of the mirror.',
      'Slide the screen along the rail, in front of the mirror, until the reflected image is sharpest.',
      'Read the object–mirror distance do and the screen–mirror distance di from the rail scale and record them.',
      'Repeat for several object positions: beyond C, at C (image the same size, at the object), and between C and F.',
      'Move the object inside the focal length: the image becomes virtual and no sharp image can be found.',
    ],
    equations: ['1/f = 1/do + 1/di', 'f = R / 2', 'm = hi/ho = −di/do'],
    assumptions: [
      'Spherical mirror in the paraxial approximation: rays close to the axis, no spherical aberration.',
      'The mirror is tilted by a negligible angle so that the returning light lands on a screen beside the object; the screen does not shadow the incoming light.',
      'Geometric optics; defocus is a uniform blur disc of diameter c = D·|s − di| / |di| (mirror aperture D).',
    ],
    fields: [
      { key: 'do', label: 'do', unit: 'cm', hint: 'object → mirror', uncertainty: 0.1 },
      { key: 'di', label: 'di', unit: 'cm', hint: 'mirror → sharp image', uncertainty: 0.1 },
    ],
    plot: conjugatePlot,
    given: () => [],
    analyze: (values, context) => {
      const stage = firstLens(context)
      const focal = focalLengthFromConjugates(cm(values.do), cm(values.di))
      return [
        result('f = (1/do + 1/di)⁻¹', fromMeters(focal, 'cm'), 'cm', stage ? fromMeters(stage.focalLength, 'cm') : null),
        result('R = 2f', fromMeters(2 * focal, 'cm'), 'cm', stage ? fromMeters(2 * stage.focalLength, 'cm') : null),
        perSetting(result('m = −di/do', magnification(cm(values.do), cm(values.di)), '', context.bench?.imaging?.sequence?.magnification ?? null)),
      ]
    },
  },
]

export function experiment(id: ExperimentId): ExperimentDefinition {
  return EXPERIMENTS.find((entry) => entry.id === id) ?? EXPERIMENTS[0]
}
