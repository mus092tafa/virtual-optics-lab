import { useMemo } from 'react'
import { AVERAGE_CORNEAL_ASPHERICITY, CHROMATIC_LINES, CONDITION_ASTIGMATISM, EYE_ABERRATION_RANGES, EYE_RANGES, EYE_REFERENCE_WAVELENGTH, EYE_WHITE_TEMPERATURE } from '../../physics/constants'
import { averageLensAsphericity, solveEye, zoneHeight } from '../../physics/eye'
import type { EyeSolution, EyeView } from '../../physics/eye'
import { degToRad, formatAxis, formatDioptres, formatLength, formatNumber, formatPrescription, fromMeters, mm, nm, radToDeg } from '../../physics/units'
import { actions, theoryVisible, useLab } from '../../state/labState'
import { CONDITION_ERROR, PRESBYOPIA_AGE, eyeCondition, toEyeSetup } from '../../state/presets'
import type { EyeChart, EyeCondition, EyeSceneView, EyeSetting } from '../../state/presets'
import { ExperimentPanel } from '../ExperimentPanel'
import { usePanelLayout } from '../hooks'
import { PanelResizer } from '../PanelResizer'
import type { ReportSection } from '../report'
import { BeamSections } from './BeamSections'
import { EyeFrontView } from './EyeFrontView'
import { EyeScene } from './EyeScene'
import { RetinalImage } from './RetinalImage'

const ARC_MINUTE = degToRad(1 / 60)
const FIELDS_OF_VIEW = [mm(0.25), mm(0.5), mm(1), mm(2), mm(4)]
const CHARTS: { id: EyeChart; label: string }[] = [
  { id: 'letters', label: 'Letter chart' },
  { id: 'text', label: 'Printed text' },
  { id: 'face', label: 'Face' },
  { id: 'fan', label: 'Fan (astigmatism)' },
]
const SCENE_VIEWS: { id: EyeSceneView; label: string; title: string }[] = [
  { id: 'side', label: 'Side', title: 'The vertical section of the eye' },
  { id: 'top', label: 'Top', title: 'The horizontal section of the eye' },
  { id: 'both', label: 'Side + top', title: 'Both sections: they differ when the eye is astigmatic' },
  { id: 'front', label: 'Front', title: 'Facing the eye: the pupil, the meridians of the cornea and the axis of the glasses' },
]
/** Wavelengths offered at a click, with the names of the lines. */
const LINES: { wavelength: number; label: string }[] = [
  { wavelength: CHROMATIC_LINES.blue, label: '486 blue' },
  { wavelength: nm(546), label: '546 green' },
  { wavelength: EYE_REFERENCE_WAVELENGTH, label: '589 yellow' },
  { wavelength: CHROMATIC_LINES.red, label: '656 red' },
]
const CONDITIONS: { id: EyeCondition; label: string; title: string }[] = [
  { id: 'normal', label: 'Normal', title: 'Normal length and cornea: distant objects are in focus when the eye is relaxed' },
  { id: 'myopia', label: 'Myopia', title: `Eye too long: K = −${CONDITION_ERROR} D` },
  { id: 'hyperopia', label: 'Hyperopia', title: `Eye too short: K = +${CONDITION_ERROR} D` },
  { id: 'presbyopia', label: 'Presbyopia', title: `Normal eye at ${PRESBYOPIA_AGE} years: the lens can no longer accommodate enough for reading` },
  { id: 'astigmatism', label: 'Astigmatism', title: `Cornea ${CONDITION_ASTIGMATISM} D steeper vertically than horizontally: 0.00 / −${CONDITION_ASTIGMATISM}.00 × 180` },
]
/** Nearest vergence the object slider offers, dioptres; its other end is a distant object. */
const NEAREST_VERGENCE = 1 / EYE_RANGES.objectDistance.min
const FARTHEST_VERGENCE = 1 / EYE_RANGES.objectDistance.max

const dioptres = formatDioptres
const distance = (value: number | null): string => (value === null ? 'none in front of the eye' : Number.isFinite(value) ? formatLength(value, 'cm', 1) : 'distant (∞)')

function matches(eye: EyeSetting, condition: EyeCondition): boolean {
  const target = { ...eye, ...eyeCondition(condition) }
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-7
  const cross = (setting: EyeSetting) => setting.cornealRadiusCross ?? setting.cornealRadius
  const shape = same(eye.axialLength, target.axialLength) && same(eye.cornealRadius, target.cornealRadius) && same(cross(eye), cross(target)) && (condition !== 'astigmatism' || same(eye.cornealMeridian, 0))
  if (condition === 'presbyopia') return shape && eye.age >= PRESBYOPIA_AGE
  return shape && (condition !== 'normal' || eye.age < PRESBYOPIA_AGE)
}

interface Row {
  label: string
  /** One value for each eye shown; a single value applies to all of them. */
  values: string[]
  theory?: boolean
}

/** What the rows of an image have to cover: the same for every eye shown beside each other. */
interface Shown {
  /** The beam has two focal lines, or the patch on the retina two diameters. */
  astigmatic: boolean
  realRays: boolean
  /** A ring stop is in the pupil. */
  ring: boolean
}

const offset = (value: number): string => (Math.abs(value) < 5e-7 ? 'on the retina' : `${formatLength(Math.abs(value), 'mm', 2)} ${value > 0 ? 'behind' : 'in front'}`)
const micrometres = (value: number, digits = 0): string => formatNumber(fromMeters(value, 'um'), digits)

/** The measurements of one image, row by row. */
function viewRows(view: EyeView, shown: Shown): { label: string; value: string; theory?: boolean }[] {
  const glasses = view.glasses
  const lines = view.focalLines
  return [
    { label: 'Glasses', value: glasses ? formatPrescription({ sphere: glasses.power, cylinder: glasses.cylinder ?? 0, axis: glasses.axis ?? 0 }) : 'none' },
    { label: shown.astigmatic ? 'Vergence at the cornea L (mean of the meridians)' : 'Vergence at the cornea L', value: dioptres(view.vergence), theory: true },
    { label: 'Accommodation needed K − L', value: dioptres(view.accommodationNeeded), theory: true },
    { label: 'Accommodation in use', value: `${formatNumber(view.accommodation, 2)} D`, theory: true },
    { label: 'Lens power', value: `${formatNumber(view.lensPower, 2)} D`, theory: true },
    { label: shown.astigmatic ? 'Total power of the eye (first meridian)' : 'Total power of the eye', value: `${formatNumber(view.totalPower, 2)} D`, theory: true },
    shown.astigmatic
      ? {
          label: 'Focal lines relative to the retina',
          value: lines ? lines.map((line) => `${offset(line.offset)} (${formatAxis(line.angle)})`).join(' · ') : 'no focus in the eye',
          theory: true,
        }
      : { label: shown.realRays ? 'Paraxial focus relative to the retina' : 'Focus relative to the retina', value: view.focusOffset === null ? 'no focus in the eye' : offset(view.focusOffset), theory: true },
    ...(shown.astigmatic
      ? [
          { label: 'Interval between the focal lines', value: lines ? formatLength(lines[1].distance - lines[0].distance, 'mm', 2) : '—', theory: true },
          {
            label: 'Blur ellipse on the retina',
            value: `${micrometres(view.blur.major)} × ${micrometres(view.blur.minor)} µm${view.blur.major - view.blur.minor > 5e-7 ? `, long axis at ${formatAxis(view.blur.angle)}` : ''}`,
            theory: true,
          },
        ]
      : []),
    ...(shown.realRays
      ? [
          {
            label: shown.ring ? 'Rays of the open ring cross the axis' : 'Edge rays cross the axis',
            value: view.sphericalAberration?.marginalOffset == null ? 'not in the eye' : offset(view.sphericalAberration.marginalOffset).replace('on the retina', 'at the retina'),
            theory: true,
          },
          {
            label: `Spherical aberration K(0) − K(h)${view.sphericalAberration ? `, h = ${formatLength(view.sphericalAberration.rayHeight, 'mm', 2)}` : ''}`,
            value: view.sphericalAberration ? dioptres(view.sphericalAberration.longitudinal) : '—',
            theory: true,
          },
        ]
      : []),
    { label: 'Blur diameter on the retina (equivalent disc)', value: `${micrometres(view.blurDiameter)} µm`, theory: true },
    { label: 'Letter height on the retina (inverted)', value: `${micrometres(Math.abs(view.letterImageHeight), 1)} µm`, theory: true },
    { label: 'Far point (from the cornea)', value: distance(view.farPoint), theory: true },
    { label: 'Near point (from the cornea)', value: distance(view.nearPoint), theory: true },
    { label: 'Sharpness (blur ÷ stroke width)', value: view.sharpness },
  ]
}

/** Section D: the schematic human eye, its accommodation and its glasses. */
export function EyeWorkspace() {
  const eye = useLab((s) => s.eye)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const examLock = useLab((s) => s.examLock)
  const layout = usePanelLayout('eye')
  const showTheory = theoryVisible({ mode, revealed })
  // An unknown eye keeps its length, cornea and age to itself until the theory is revealed.
  const hidden = eye.concealed && !showTheory

  const setup = useMemo(() => toEyeSetup(eye), [eye])
  const solution = useMemo(() => solveEye(setup, EYE_RANGES.pupilDiameter.max), [setup])
  // The second eye is offered only for an eye whose age is known.
  const compared = useMemo(() => (eye.compareAge === null || hidden ? null : solveEye(toEyeSetup(eye, eye.compareAge), EYE_RANGES.pupilDiameter.max)), [eye, hidden])
  const context = useMemo(() => ({ components: [], bench: null, surface: null, michelson: null, prism: null, eye: solution }), [solution])
  const { view, bare } = solution
  const set = actions.updateEye

  // Each eye shown: the eye as it is, the same eye without its glasses, and the eye of the other age.
  const columns: { title: string; view: EyeView; solution: EyeSolution }[] = [
    { title: compared ? `Age ${eye.age}${bare ? ' with glasses' : ''}` : bare ? 'With glasses' : 'This eye', view, solution },
    ...(bare ? [{ title: compared ? `Age ${eye.age} without` : 'Without glasses', view: bare, solution }] : []),
    ...(compared ? [{ title: `Age ${eye.compareAge}${bare ? ' with glasses' : ''}`, view: compared.view, solution: compared }] : []),
  ]
  const cylinder = eye.glassesOn && eye.glassesCylinder !== 0
  // An unknown eye gets the rows of an astigmatic one, so that the table does not say whether it is.
  const shown: Shown = { astigmatic: hidden || solution.astigmatic || cylinder, realRays: solution.realRays, ring: solution.realRays && eye.pupilZone > 0 }
  const perEye = columns.map((column) => viewRows(column.view, shown))
  const light = eye.wavelength === null ? `white (${EYE_WHITE_TEMPERATURE} K)` : `${formatNumber(fromMeters(eye.wavelength, 'nm'), 0)} nm`
  const unknown = (value: string) => (hidden ? 'unknown' : value)
  const eyeRows: Row[] = [
    { label: 'Object distance (from the cornea)', values: [distance(eye.objectDistance ?? Infinity)] },
    { label: 'Pupil diameter', values: [formatLength(eye.pupilDiameter, 'mm', 1)] },
    { label: 'Axial length', values: [hidden ? 'unknown' : formatLength(eye.axialLength, 'mm', 2)] },
    ...(hidden
      ? [
          { label: 'Corneal radii and their meridians', values: ['unknown'] },
          { label: 'Corneal powers (n′ − 1)/r', values: ['unknown'] },
        ]
      : solution.astigmatic
      ? [
          { label: `Corneal radius at ${formatAxis(eye.cornealMeridian)} and across it`, values: [`${formatLength(eye.cornealRadius, 'mm', 2)} · ${formatLength(eye.cornealRadiusCross ?? eye.cornealRadius, 'mm', 2)}`] },
          { label: 'Corneal powers (n′ − 1)/r', values: [`${formatNumber(solution.cornealPower, 2)} D · ${formatNumber(solution.cornealPowerCross, 2)} D`] },
        ]
      : [
          { label: 'Corneal radius', values: [unknown(formatLength(eye.cornealRadius, 'mm', 2))] },
          { label: 'Corneal power (n′ − 1)/r', values: [unknown(`${formatNumber(solution.cornealPower, 2)} D`)] },
        ]),
    ...(solution.realRays ? [{ label: 'Asphericity Q of the cornea · of the lens', values: [unknown(`${formatNumber(eye.cornealAsphericity, 2)} · ${formatNumber(eye.lensAsphericity, 2)}`)] }] : []),
    { label: 'Light on the chart', values: [eye.dispersion ? light : `${light}; the eye has its 589 nm indices`] },
    { label: 'Age', values: [hidden ? 'unknown' : `${eye.age} years`] },
    { label: 'Relaxed lens power', values: [`${formatNumber(solution.relaxedLensPower, 2)} D`] },
    solution.astigmatic || hidden
      ? { label: 'Refraction K (sphere / cylinder × axis)', values: [formatPrescription(solution.refraction)], theory: true }
      : { label: eye.dispersion ? `Refractive error K at ${formatNumber(fromMeters(solution.wavelength, 'nm'), 0)} nm` : 'Refractive error K', values: [dioptres(solution.refractiveError)], theory: true },
    ...(solution.chromaticDifference === null ? [] : [{ label: 'Chromatic difference K(656 nm) − K(486 nm)', values: [dioptres(solution.chromaticDifference)], theory: true }]),
    { label: 'Largest accommodation (average for the age)', values: columns.length > 1 && compared ? columns.map((column) => `${formatNumber(column.solution.maxAccommodation, 1)} D`) : [`${formatNumber(solution.maxAccommodation, 1)} D`], theory: true },
    { label: `Correcting glasses at ${formatLength(eye.vertexDistance, 'mm', 0)}  K/(1 + dK)`, values: [solution.astigmatic || hidden ? formatPrescription(solution.correctingLens) : dioptres(solution.correctingPower)], theory: true },
  ]
  const lightRows: Row[] = perEye[0].map((entry, index) => ({ label: entry.label, theory: entry.theory, values: perEye.map((rows) => rows[index].value) }))
  const report: ReportSection[] = [
    { title: 'Eye', rows: eyeRows.map((row) => ({ label: row.label, value: row.values.join(' · '), theory: row.theory })) },
    ...columns.map((column, index) => ({
      title: `Image — ${column.title.toLowerCase()}`,
      rows: lightRows.map((row) => ({ label: row.label, value: row.values[index], theory: row.theory })),
    })),
  ]

  const notices: { level: 'info' | 'warning'; text: string }[] = solution.notices.map((text) => ({ level: 'warning', text }))
  if (view.focusDistance === null) notices.push({ level: 'warning', text: 'The light leaves the lens without converging: no image is formed in the eye.' })
  if (showTheory && eye.heldAccommodation === null) {
    if (view.accommodationNeeded > solution.maxAccommodation + 1e-9) {
      notices.push({ level: 'info', text: 'The object is nearer than the near point: the lens is as curved as it can be at this age, and the focus stays behind the retina.' })
    } else if (view.accommodationNeeded < -1e-9) {
      notices.push({ level: 'info', text: 'The eye would have to relax beyond its relaxed state: the focus stays in front of the retina.' })
    }
  }

  // The switches of the model belong to the eye: they are fixed on an exam bench and for an unknown eye.
  const modelLocked = examLock !== null || eye.concealed
  const vergence = eye.objectDistance === null ? 0 : 1 / eye.objectDistance
  const held = eye.heldAccommodation !== null
  const table = (rows: Row[], titles: string[] | null) => (
    <table className="eye-table">
      {titles && (
        <thead>
          <tr>
            <th />
            {titles.map((title) => (
              <th key={title}>{title}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.theory && !showTheory ? (
              <td className="withheld" colSpan={titles?.length ?? 1}>
                to be determined
              </td>
            ) : row.values.length === 1 ? (
              <td colSpan={titles?.length ?? 1}>{row.values[0]}</td>
            ) : (
              row.values.map((value, index) => <td key={index}>{value}</td>)
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <main className="workspace eye-workspace" style={layout.style}>
      <section className="panel surface-panel" aria-label="Eye">
        <header className="panel-header">
          <h2>Human eye</h2>
          <span className="model-tag imaging">geometric optics</span>
          <span className="panel-sub">{hidden ? 'unknown eye, drawn as the standard eye' : 'schematic eye, to scale; the object is set by its distance and is not drawn'}</span>
          <div className="bench-tools">
            <div className="chip-group" role="radiogroup" aria-label="View of the eye">
              {SCENE_VIEWS.map((entry) => (
                <button key={entry.id} role="radio" aria-checked={eye.sceneView === entry.id} className={`chip${eye.sceneView === entry.id ? ' active' : ''}`} title={entry.title} onClick={() => set({ sceneView: entry.id })}>
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </header>
        {eye.sceneView === 'front' ? (
          <EyeFrontView setup={setup} unknown={hidden} />
        ) : (
          <div className="eye-views">
            {eye.sceneView !== 'top' && <EyeScene setup={setup} view={view} showLight={showTheory} unknown={hidden} section="side" titled={eye.sceneView === 'both'} />}
            {eye.sceneView !== 'side' && <EyeScene setup={setup} view={view} showLight={showTheory} unknown={hidden} section="top" titled />}
          </div>
        )}
      </section>

      <PanelResizer label="the image" axis="x" target="next" column={2} row="1 / -1" {...layout.handle('side')} />
      <section className="panel screen-panel eye-image-panel" aria-label="Image on the retina">
        <header className="panel-header">
          <h2>Image</h2>
          <span className="panel-sub">the chart as this eye sees it</span>
        </header>
        <div className={`retinal-images${columns.length > 1 ? ' several' : ''}`}>
          {columns.map((column) => (
            <RetinalImage key={column.title} view={column.view} chart={eye.chart} fieldOfView={eye.fieldOfView} label={`${column.title}: ${column.view.sharpness}`} />
          ))}
        </div>
        <div className="screen-controls">
          <div className="control-row">
            <label htmlFor="eye-field">Field of view</label>
            <div className="chip-group" id="eye-field">
              {FIELDS_OF_VIEW.map((value) => (
                <button key={value} className={`chip${Math.abs(value - eye.fieldOfView) / value < 0.02 ? ' active' : ''}`} onClick={() => set({ fieldOfView: value })}>
                  {fromMeters(value, 'mm')} mm
                </button>
              ))}
            </div>
          </div>
          <p className="hint">Width of the patch of retina shown. Brightness follows the area of the pupil.{eye.chart === 'fan' ? ' The numbers on the fan are meridians in degrees, as an examiner facing the eye counts them.' : ''}</p>
          {showTheory && (
            <>
              <span className="field-label">Beam cross-sections</span>
              <BeamSections view={view} note={view.pointSpread.length > 1 ? 'Drawn for 589 nm, the wavelength the eye focuses in white light.' : undefined} />
            </>
          )}
        </div>
      </section>

      <PanelResizer label="the lower panels" axis="y" target="next" column={1} row={2} {...layout.handle('bottom')} />
      <div className={`bottom-row${examLock && !examLock.notebook ? ' pair' : ''}`}>
        <section className="panel controls" aria-label="Controls">
          <header className="panel-header">
            <h2>Controls</h2>
            {mode === 'experiment' && !examLock && (
              <button className="chip" onClick={() => (eye.concealed ? actions.useKnownEye() : actions.useUnknownEye())} title="An eye whose refractive error you have to find">
                {eye.concealed ? 'Use the known eye' : 'Use an unknown eye'}
              </button>
            )}
          </header>
          <div className="control-body">
            <span className="field-label">Object</span>
            <div className="control-row">
              <label htmlFor="eye-distance">Distance</label>
              <input
                id="eye-distance"
                type="range"
                min={0}
                max={NEAREST_VERGENCE}
                step={0.05}
                value={Number(vergence.toFixed(2))}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  set({ objectDistance: value < FARTHEST_VERGENCE / 2 ? null : 1 / Math.max(value, FARTHEST_VERGENCE) })
                }}
              />
              <output>{distance(eye.objectDistance ?? Infinity)}</output>
            </div>
            {eye.objectDistance === null ? (
              <div className="control-row">
                <label htmlFor="eye-angle">Letter size</label>
                <input id="eye-angle" type="range" min={2} max={60} step={1} value={Math.round(eye.letterAngle / ARC_MINUTE)} onChange={(event) => set({ letterAngle: Number(event.target.value) * ARC_MINUTE })} />
                <output>{Math.round(eye.letterAngle / ARC_MINUTE)}′ of arc</output>
              </div>
            ) : (
              <div className="control-row">
                <label htmlFor="eye-letter">Letter height</label>
                <input
                  id="eye-letter"
                  type="range"
                  min={-0.7}
                  max={1.7}
                  step={0.02}
                  value={Number(Math.log10(fromMeters(eye.letterHeight, 'mm')).toFixed(2))}
                  onChange={(event) => set({ letterHeight: mm(Math.pow(10, Number(event.target.value))) })}
                />
                <output>{formatLength(eye.letterHeight, 'mm', eye.letterHeight < mm(10) ? 2 : 1)}</output>
              </div>
            )}
            <div className="control-row">
              <label htmlFor="eye-chart">Chart</label>
              <select id="eye-chart" value={eye.chart} onChange={(event) => set({ chart: event.target.value as EyeChart })}>
                {CHARTS.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="field-label">Eye</span>
            {hidden ? (
              <p className="concealed">Unknown eye: its length, its cornea and its age are not given. Find its far point, its near point or its glasses from the image.</p>
            ) : (
              <>
                <div className="control-row">
                  <label>Condition</label>
                  <div className="chip-group">
                    {CONDITIONS.map((condition) => (
                      <button key={condition.id} className={`chip${matches(eye, condition.id) ? ' active' : ''}`} title={condition.title} onClick={() => actions.setEyeCondition(condition.id)}>
                        {condition.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-length">Axial length</label>
                  <input id="eye-length" type="range" min={fromMeters(EYE_RANGES.axialLength.min, 'mm')} max={fromMeters(EYE_RANGES.axialLength.max, 'mm')} step={0.01} value={Number(fromMeters(eye.axialLength, 'mm').toFixed(2))} onChange={(event) => set({ axialLength: mm(Number(event.target.value)) })} />
                  <output>{formatLength(eye.axialLength, 'mm', 2)}</output>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-cornea">Corneal radius</label>
                  <input id="eye-cornea" type="range" min={fromMeters(EYE_RANGES.cornealRadius.min, 'mm')} max={fromMeters(EYE_RANGES.cornealRadius.max, 'mm')} step={0.01} value={Number(fromMeters(eye.cornealRadius, 'mm').toFixed(2))} onChange={(event) => set({ cornealRadius: mm(Number(event.target.value)) })} />
                  <output>
                    {formatLength(eye.cornealRadius, 'mm', 2)} → {formatNumber(solution.cornealPower, 1)} D
                  </output>
                </div>
                <div className="control-row">
                  <label className="check" htmlFor="eye-toric" title="A second radius for the meridian at right angles to the first: an astigmatic cornea">
                    <input id="eye-toric" type="checkbox" checked={eye.cornealRadiusCross !== null} onChange={(event) => set({ cornealRadiusCross: event.target.checked ? eye.cornealRadius : null })} />
                    Second radius
                  </label>
                  <input
                    type="range"
                    aria-label="Corneal radius in the meridian at right angles to the first"
                    min={fromMeters(EYE_RANGES.cornealRadius.min, 'mm')}
                    max={fromMeters(EYE_RANGES.cornealRadius.max, 'mm')}
                    step={0.01}
                    disabled={eye.cornealRadiusCross === null}
                    value={Number(fromMeters(eye.cornealRadiusCross ?? eye.cornealRadius, 'mm').toFixed(2))}
                    onChange={(event) => set({ cornealRadiusCross: mm(Number(event.target.value)) })}
                  />
                  <output>{eye.cornealRadiusCross === null ? 'same' : `${formatLength(eye.cornealRadiusCross, 'mm', 2)} → ${formatNumber(solution.cornealPowerCross, 1)} D`}</output>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-meridian" title="Direction of the meridian of the first radius, as seen facing the eye">
                    Meridian
                  </label>
                  <input id="eye-meridian" type="range" min={0} max={175} step={5} disabled={eye.cornealRadiusCross === null} value={Math.round(radToDeg(eye.cornealMeridian)) % 180} onChange={(event) => set({ cornealMeridian: degToRad(Number(event.target.value)) })} />
                  <output>{eye.cornealRadiusCross === null ? '—' : formatAxis(eye.cornealMeridian)}</output>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-age">Age</label>
                  <input id="eye-age" type="range" min={EYE_RANGES.age.min} max={EYE_RANGES.age.max} step={1} value={eye.age} onChange={(event) => set({ age: Number(event.target.value) })} />
                  <output>{eye.age} years</output>
                </div>
                <div className="control-row">
                  <label className="check" htmlFor="eye-compare">
                    <input id="eye-compare" type="checkbox" checked={eye.compareAge !== null} onChange={(event) => set({ compareAge: event.target.checked ? (eye.age < 45 ? 60 : 20) : null })} />
                    Compare age
                  </label>
                  <input type="range" aria-label="Age of the second eye" min={EYE_RANGES.age.min} max={EYE_RANGES.age.max} step={1} disabled={eye.compareAge === null} value={eye.compareAge ?? eye.age} onChange={(event) => set({ compareAge: Number(event.target.value) })} />
                  <output>{eye.compareAge === null ? '—' : `${eye.compareAge} years`}</output>
                </div>
              </>
            )}
            <div className="control-row">
              <label htmlFor="eye-pupil">Pupil</label>
              <input id="eye-pupil" type="range" min={fromMeters(EYE_RANGES.pupilDiameter.min, 'mm')} max={fromMeters(EYE_RANGES.pupilDiameter.max, 'mm')} step={0.5} value={fromMeters(eye.pupilDiameter, 'mm')} onChange={(event) => set({ pupilDiameter: mm(Number(event.target.value)) })} />
              <output>{formatLength(eye.pupilDiameter, 'mm', 1)}</output>
            </div>
            <div className="control-row">
              <label className="check" htmlFor="eye-hold" title="Off: the eye accommodates by itself, as far as it can">
                <input id="eye-hold" type="checkbox" checked={held} onChange={(event) => set({ heldAccommodation: event.target.checked ? view.accommodation : null })} />
                Hold the lens
              </label>
              <input
                type="range"
                aria-label="Accommodation the lens is held at"
                min={0}
                max={1}
                step={0.005}
                disabled={!held || solution.maxAccommodation === 0}
                value={solution.maxAccommodation > 0 ? Number((view.accommodation / solution.maxAccommodation).toFixed(3)) : 0}
                onChange={(event) => set({ heldAccommodation: Number(event.target.value) * solution.maxAccommodation })}
              />
              <output>{!held ? 'automatic' : showTheory ? `${formatNumber(view.accommodation, 2)} D` : `${Math.round((100 * view.accommodation) / Math.max(solution.maxAccommodation, 1e-9))}% of its range`}</output>
            </div>

            <span className="field-label">Light</span>
            <div className="control-row">
              <label>Chart lit with</label>
              <div className="chip-group">
                <button className={`chip${eye.wavelength === null ? ' active' : ''}`} title={`White light: a black body of ${EYE_WHITE_TEMPERATURE} K`} onClick={() => set({ wavelength: null })}>
                  White
                </button>
                {LINES.map((line) => (
                  <button key={line.label} className={`chip${eye.wavelength !== null && Math.abs(eye.wavelength - line.wavelength) < nm(0.5) ? ' active' : ''}`} onClick={() => set({ wavelength: line.wavelength })}>
                    {line.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-row">
              <label htmlFor="eye-wavelength">Wavelength</label>
              <input
                id="eye-wavelength"
                type="range"
                min={fromMeters(EYE_ABERRATION_RANGES.wavelength.min, 'nm')}
                max={fromMeters(EYE_ABERRATION_RANGES.wavelength.max, 'nm')}
                step={1}
                value={Math.round(fromMeters(eye.wavelength ?? EYE_REFERENCE_WAVELENGTH, 'nm'))}
                onChange={(event) => set({ wavelength: nm(Number(event.target.value)) })}
              />
              <output>{eye.wavelength === null ? 'white' : `${formatNumber(fromMeters(eye.wavelength, 'nm'), 0)} nm`}</output>
            </div>
            <div className="control-row">
              <label className="check" htmlFor="eye-dispersion" title="The refractive indices of the eye follow the wavelength. Off: the schematic eye's 589 nm indices in every light.">
                <input id="eye-dispersion" type="checkbox" checked={eye.dispersion} disabled={modelLocked} onChange={(event) => set({ dispersion: event.target.checked })} />
                Chromatic aberration
              </label>
            </div>

            <span className="field-label">Rays</span>
            <div className="control-row">
              <label className="check" htmlFor="eye-real" title="Snell's law at every surface instead of the small-angle approximation. For an eye with one corneal radius and glasses without a cylinder.">
                <input id="eye-real" type="checkbox" checked={eye.realRays} disabled={modelLocked} onChange={(event) => set({ realRays: event.target.checked })} />
                Real rays (spherical aberration)
              </label>
            </div>
            <div className="control-row">
              <label htmlFor="eye-ring" title="A stop in the pupil that lets only an outer ring through: one zone of the pupil at a time. For real rays.">
                Ring stop
              </label>
              <input id="eye-ring" type="range" {...EYE_ABERRATION_RANGES.pupilZone} disabled={!eye.realRays} value={eye.pupilZone} onChange={(event) => set({ pupilZone: Number(event.target.value) })} />
              <output>
                {eye.pupilZone === 0 || !eye.realRays
                  ? 'open pupil'
                  : `${formatNumber(fromMeters((eye.pupilZone * eye.pupilDiameter) / 2, 'mm'), 2)}–${formatNumber(fromMeters(eye.pupilDiameter / 2, 'mm'), 2)} mm, h = ${formatLength(zoneHeight(eye.pupilDiameter, eye.pupilZone), 'mm', 2)}`}
              </output>
            </div>
            {!hidden && (
              <>
                <div className="control-row">
                  <label>Surfaces</label>
                  <div className="chip-group">
                    <button className={`chip${eye.cornealAsphericity === 0 && eye.lensAsphericity === 0 ? ' active' : ''}`} disabled={!eye.realRays} title="The schematic eye as published: Q = 0 everywhere" onClick={() => set({ cornealAsphericity: 0, lensAsphericity: 0 })}>
                      Spheres
                    </button>
                    <button
                      className={`chip${Math.abs(eye.cornealAsphericity - AVERAGE_CORNEAL_ASPHERICITY) < 0.005 && Math.abs(eye.lensAsphericity - averageLensAsphericity()) < 0.03 ? ' active' : ''}`}
                      disabled={!eye.realRays}
                      title="Cornea Q = −0.26; lens Q solved for the mean measured spherical aberration, 1.0 D at 3 mm"
                      onClick={() => set({ cornealAsphericity: AVERAGE_CORNEAL_ASPHERICITY, lensAsphericity: averageLensAsphericity() })}
                    >
                      Average eye
                    </button>
                  </div>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-q-cornea" title="Asphericity of the cornea: 0 a sphere, negative values flatten it towards the edge">
                    Q cornea
                  </label>
                  <input id="eye-q-cornea" type="range" {...EYE_ABERRATION_RANGES.cornealAsphericity} disabled={!eye.realRays} value={eye.cornealAsphericity} onChange={(event) => set({ cornealAsphericity: Number(event.target.value) })} />
                  <output>{formatNumber(eye.cornealAsphericity, 2)}</output>
                </div>
                <div className="control-row">
                  <label htmlFor="eye-q-lens" title="Asphericity of both surfaces of the lens">
                    Q lens
                  </label>
                  <input id="eye-q-lens" type="range" {...EYE_ABERRATION_RANGES.lensAsphericity} disabled={!eye.realRays} value={Number(eye.lensAsphericity.toFixed(2))} onChange={(event) => set({ lensAsphericity: Number(event.target.value) })} />
                  <output>{formatNumber(eye.lensAsphericity, 2)}</output>
                </div>
              </>
            )}

            <span className="field-label">Glasses</span>
            <div className="control-row">
              <label className="check" htmlFor="eye-glasses">
                <input id="eye-glasses" type="checkbox" checked={eye.glassesOn} onChange={(event) => set({ glassesOn: event.target.checked })} />
                Wear
              </label>
              <input
                type="range"
                aria-label="Power of the glasses"
                min={EYE_RANGES.glassesPower.min}
                max={EYE_RANGES.glassesPower.max}
                step={EYE_RANGES.glassesPower.step}
                disabled={!eye.glassesOn}
                value={eye.glassesPower}
                onChange={(event) => set({ glassesPower: Number(event.target.value) })}
              />
              <output>{dioptres(eye.glassesPower)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="eye-cylinder" title="Power added in the meridian at right angles to the axis">
                Cylinder
              </label>
              <input id="eye-cylinder" type="range" {...EYE_ABERRATION_RANGES.glassesCylinder} disabled={!eye.glassesOn} value={eye.glassesCylinder} onChange={(event) => set({ glassesCylinder: Number(event.target.value) })} />
              <output>{dioptres(eye.glassesCylinder)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="eye-axis" title="Axis of the cylinder as seen facing the eye, counter-clockwise from the horizontal">
                Axis
              </label>
              <input
                id="eye-axis"
                type="range"
                min={1}
                max={180}
                step={1}
                disabled={!eye.glassesOn || eye.glassesCylinder === 0}
                value={Math.round(radToDeg(eye.glassesAxis)) % 180 || 180}
                onChange={(event) => set({ glassesAxis: degToRad(Number(event.target.value)) })}
              />
              <output>{eye.glassesCylinder === 0 ? '—' : formatAxis(eye.glassesAxis)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="eye-vertex">Vertex distance</label>
              <input id="eye-vertex" type="range" min={0} max={fromMeters(EYE_RANGES.vertexDistance.max, 'mm')} step={1} disabled={!eye.glassesOn} value={Math.round(fromMeters(eye.vertexDistance, 'mm'))} onChange={(event) => set({ vertexDistance: mm(Number(event.target.value)) })} />
              <output>{formatLength(eye.vertexDistance, 'mm', 0)}</output>
            </div>
          </div>
        </section>

        <PanelResizer label="the controls" axis="x" target="previous" column={2} row={1} {...layout.handle('controls')} />
        <section className="panel physics" aria-label="Measurements">
          <header className="panel-header">
            <h2>Physics</h2>
            {mode === 'experiment' && !examLock && (
              <button className="chip" onClick={() => actions.setRevealed(!revealed)}>
                {revealed ? 'Hide theory' : 'Reveal theory'}
              </button>
            )}
          </header>
          <div className="physics-body">
            {notices.map((notice) => (
              <p key={notice.text} className={`notice ${notice.level}`}>
                {notice.text}
              </p>
            ))}
            <div className="report-section">
              <h3>Eye</h3>
              {table(eyeRows, compared ? columns.map((column) => column.title) : null)}
            </div>
            <div className="report-section">
              <h3>Image of the object</h3>
              {table(lightRows, columns.length > 1 ? columns.map((column) => column.title) : null)}
            </div>
            {showTheory && <p className="hint">The largest accommodation is Hofstetter’s average, 18.5 − 0.30 × age dioptres; individual eyes differ from it by several dioptres.</p>}
          </div>
        </section>

        {(!examLock || examLock.notebook) && (
          <>
            <PanelResizer label="the physics panel" axis="x" target="previous" column={3} row={1} {...layout.handle('physics')} />
            <ExperimentPanel context={context} setup={report} />
          </>
        )}
      </div>
    </main>
  )
}
