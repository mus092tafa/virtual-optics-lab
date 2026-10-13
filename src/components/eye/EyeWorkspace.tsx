import { useMemo } from 'react'
import { EYE_RANGES } from '../../physics/constants'
import { solveEye } from '../../physics/eye'
import type { EyeSolution, EyeView } from '../../physics/eye'
import { degToRad, formatLength, formatNumber, fromMeters, mm } from '../../physics/units'
import { actions, theoryVisible, useLab } from '../../state/labState'
import { CONDITION_ERROR, PRESBYOPIA_AGE, eyeCondition, toEyeSetup } from '../../state/presets'
import type { EyeChart, EyeCondition, EyeSetting } from '../../state/presets'
import { ExperimentPanel } from '../ExperimentPanel'
import { usePanelLayout } from '../hooks'
import { PanelResizer } from '../PanelResizer'
import type { ReportSection } from '../report'
import { EyeScene } from './EyeScene'
import { RetinalImage } from './RetinalImage'

const ARC_MINUTE = degToRad(1 / 60)
const FIELDS_OF_VIEW = [mm(0.25), mm(0.5), mm(1), mm(2), mm(4)]
const CHARTS: { id: EyeChart; label: string }[] = [
  { id: 'letters', label: 'Letter chart' },
  { id: 'text', label: 'Printed text' },
  { id: 'face', label: 'Face' },
]
const CONDITIONS: { id: EyeCondition; label: string; title: string }[] = [
  { id: 'normal', label: 'Normal', title: 'Normal length and cornea: distant objects are in focus when the eye is relaxed' },
  { id: 'myopia', label: 'Myopia', title: `Eye too long: K = −${CONDITION_ERROR} D` },
  { id: 'hyperopia', label: 'Hyperopia', title: `Eye too short: K = +${CONDITION_ERROR} D` },
  { id: 'presbyopia', label: 'Presbyopia', title: `Normal eye at ${PRESBYOPIA_AGE} years: the lens can no longer accommodate enough for reading` },
]
/** Nearest vergence the object slider offers, dioptres; its other end is a distant object. */
const NEAREST_VERGENCE = 1 / EYE_RANGES.objectDistance.min
const FARTHEST_VERGENCE = 1 / EYE_RANGES.objectDistance.max

const dioptres = (value: number, digits = 2): string => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)} D`
const distance = (value: number | null): string => (value === null ? 'none in front of the eye' : Number.isFinite(value) ? formatLength(value, 'cm', 1) : 'distant (∞)')

function matches(eye: EyeSetting, condition: EyeCondition): boolean {
  const target = { ...eye, ...eyeCondition(condition) }
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-7
  const shape = same(eye.axialLength, target.axialLength) && same(eye.cornealRadius, target.cornealRadius)
  if (condition === 'presbyopia') return shape && eye.age >= PRESBYOPIA_AGE
  return shape && (condition !== 'normal' || eye.age < PRESBYOPIA_AGE)
}

interface Row {
  label: string
  /** One value for each eye shown; a single value applies to all of them. */
  values: string[]
  theory?: boolean
}

function viewRows(view: EyeView): Row['values'][] {
  return [
    [view.glasses ? dioptres(view.glasses.power) : 'none'],
    [dioptres(view.vergence)],
    [dioptres(view.accommodationNeeded)],
    [`${formatNumber(view.accommodation, 2)} D`],
    [`${formatNumber(view.lensPower, 2)} D`],
    [`${formatNumber(view.totalPower, 2)} D`],
    [view.focusOffset === null ? 'no focus in the eye' : Math.abs(view.focusOffset) < 5e-7 ? 'on the retina' : `${formatLength(Math.abs(view.focusOffset), 'mm', 2)} ${view.focusOffset > 0 ? 'behind' : 'in front'}`],
    [`${formatNumber(fromMeters(view.blurDiameter, 'um'), 0)} µm`],
    [`${formatNumber(fromMeters(Math.abs(view.letterImageHeight), 'um'), 1)} µm`],
    [distance(view.farPoint)],
    [distance(view.nearPoint)],
    [view.sharpness],
  ]
}

const VIEW_LABELS: { label: string; theory?: boolean }[] = [
  { label: 'Glasses' },
  { label: 'Vergence at the cornea L', theory: true },
  { label: 'Accommodation needed K − L', theory: true },
  { label: 'Accommodation in use', theory: true },
  { label: 'Lens power', theory: true },
  { label: 'Total power of the eye', theory: true },
  { label: 'Focus relative to the retina', theory: true },
  { label: 'Blur-disc diameter on the retina', theory: true },
  { label: 'Letter height on the retina (inverted)', theory: true },
  { label: 'Far point (from the cornea)', theory: true },
  { label: 'Near point (from the cornea)', theory: true },
  { label: 'Sharpness (blur ÷ stroke width)' },
]

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
  const perEye = columns.map((column) => viewRows(column.view))
  const eyeRows: Row[] = [
    { label: 'Object distance (from the cornea)', values: [distance(eye.objectDistance ?? Infinity)] },
    { label: 'Pupil diameter', values: [formatLength(eye.pupilDiameter, 'mm', 1)] },
    { label: 'Axial length', values: [hidden ? 'unknown' : formatLength(eye.axialLength, 'mm', 2)] },
    { label: 'Corneal radius', values: [hidden ? 'unknown' : formatLength(eye.cornealRadius, 'mm', 2)] },
    { label: 'Corneal power (n′ − 1)/r', values: [hidden ? 'unknown' : `${formatNumber(solution.cornealPower, 2)} D`] },
    { label: 'Age', values: [hidden ? 'unknown' : `${eye.age} years`] },
    { label: 'Relaxed lens power', values: [`${formatNumber(solution.relaxedLensPower, 2)} D`] },
    { label: 'Refractive error K', values: [dioptres(solution.refractiveError)], theory: true },
    { label: 'Largest accommodation (average for the age)', values: columns.length > 1 && compared ? columns.map((column) => `${formatNumber(column.solution.maxAccommodation, 1)} D`) : [`${formatNumber(solution.maxAccommodation, 1)} D`], theory: true },
    { label: `Correcting glasses at ${formatLength(eye.vertexDistance, 'mm', 0)}  K/(1 + dK)`, values: [dioptres(solution.correctingPower)], theory: true },
  ]
  const lightRows: Row[] = VIEW_LABELS.map((entry, index) => ({ ...entry, values: perEye.map((rows) => rows[index][0]) }))
  const report: ReportSection[] = [
    { title: 'Eye', rows: eyeRows.map((row) => ({ label: row.label, value: row.values.join(' · '), theory: row.theory })) },
    ...columns.map((column, index) => ({
      title: `Image — ${column.title.toLowerCase()}`,
      rows: lightRows.map((row) => ({ label: row.label, value: row.values[index], theory: row.theory })),
    })),
  ]

  const notices: { level: 'info' | 'warning'; text: string }[] = []
  if (view.focusDistance === null) notices.push({ level: 'warning', text: 'The light leaves the lens without converging: no image is formed in the eye.' })
  if (showTheory && eye.heldAccommodation === null) {
    if (view.accommodationNeeded > solution.maxAccommodation + 1e-9) {
      notices.push({ level: 'info', text: 'The object is nearer than the near point: the lens is as curved as it can be at this age, and the focus stays behind the retina.' })
    } else if (view.accommodationNeeded < -1e-9) {
      notices.push({ level: 'info', text: 'The eye would have to relax beyond its relaxed state: the focus stays in front of the retina.' })
    }
  }

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
        </header>
        <EyeScene setup={setup} view={view} showLight={showTheory} unknown={hidden} />
      </section>

      <PanelResizer label="the image" axis="x" target="next" column={2} row="1 / -1" {...layout.handle('side')} />
      <section className="panel screen-panel eye-image-panel" aria-label="Image on the retina">
        <header className="panel-header">
          <h2>Image</h2>
          <span className="panel-sub">the chart as this eye images it, shown upright</span>
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
          <p className="hint">Width of the patch of retina shown. Brightness follows the area of the pupil.</p>
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
              <p className="concealed">Unknown eye: its length, cornea and age are not given. Find its far point, its near point or its glasses from the image.</p>
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
