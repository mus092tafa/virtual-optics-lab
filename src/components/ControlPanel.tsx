import { HENE_LINES, LENS_FOCAL_LENGTHS, RAIL_LENGTH } from '../physics/constants'
import { OBJECT_SHAPES } from '../physics/types'
import type { BenchComponent, SlitOrientation } from '../physics/types'
import { cm, formatLength, fromMeters, mm } from '../physics/units'
import { actions, theoryVisible, useLab } from '../state/labState'
import { KIND_NAMES } from './labels'

interface SliderProps {
  label: string
  /** Value in display units. */
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange(value: number): void
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  const id = `slider-${label.replace(/\W+/g, '-')}`
  return (
    <div className="control-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output>{display}</output>
    </div>
  )
}

function OrientationControl({ value, onChange }: { value: SlitOrientation; onChange(value: SlitOrientation): void }) {
  return (
    <div className="control-row">
      <label>Slit orientation</label>
      <div className="chip-group">
        {(['vertical', 'horizontal'] as const).map((option) => (
          <button key={option} className={`chip${value === option ? ' active' : ''}`} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Controls for the selected bench component. */
export function ControlPanel() {
  const components = useLab((s) => s.components)
  const selectedId = useLab((s) => s.selectedId)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  const component = components.find((c) => c.id === selectedId) ?? null

  const patch = (changes: Partial<BenchComponent>) => component && actions.updateComponent(component.id, changes)

  return (
    <section className="panel controls" aria-label="Experiment controls">
      <header className="panel-header">
        <h2>Controls</h2>
        <span className="panel-sub">{component ? KIND_NAMES[component.kind] : 'select a component on the bench'}</span>
      </header>
      {!component && (
        <div className="component-list">
          {[...components]
            .sort((a, b) => a.x - b.x)
            .map((c) => (
              <button key={c.id} className="list-row" onClick={() => actions.select(c.id)}>
                <span>{KIND_NAMES[c.kind]}</span>
                <span className="mono">{formatLength(c.x, 'cm', 1)}</span>
              </button>
            ))}
          {components.length === 0 && <p className="empty">The bench is empty. Add components from the list on the left, or choose an experiment.</p>}
        </div>
      )}
      {component && (
        <div className="control-body">
          <Slider
            label="Position"
            value={fromMeters(component.x, 'cm')}
            min={0}
            max={fromMeters(RAIL_LENGTH, 'cm')}
            step={0.1}
            display={formatLength(component.x, 'cm', 1)}
            onChange={(value) => actions.moveComponent(component.id, cm(value))}
          />

          {component.kind === 'laser' && (
            <div className="control-row">
              <label htmlFor="laser-line">Emission line</label>
              <select id="laser-line" value={component.lineId} onChange={(event) => patch({ lineId: event.target.value })}>
                {HENE_LINES.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {component.kind === 'tungsten' && (
            <>
              <Slider
                label="Intensity"
                value={Math.round(component.intensity * 100)}
                min={0}
                max={100}
                step={1}
                display={`${Math.round(component.intensity * 100)}%`}
                onChange={(value) => patch({ intensity: value / 100 })}
              />
              <Slider
                label="Source aperture"
                value={fromMeters(component.sourceSize, 'mm')}
                min={0.1}
                max={10}
                step={0.1}
                display={formatLength(component.sourceSize, 'mm', 1)}
                onChange={(value) => patch({ sourceSize: mm(value) })}
              />
            </>
          )}

          {component.kind === 'lens' && (
            <>
              <div className="control-row">
                <label>Focal length</label>
                {component.concealed && !showTheory ? (
                  <span className="concealed">unknown — determine it by experiment</span>
                ) : (
                  <div className="chip-group">
                    {LENS_FOCAL_LENGTHS.map((f) => (
                      <button
                        key={f}
                        className={`chip${Math.abs(component.focalLength - f) < 1e-9 ? ' active' : ''}`}
                        onClick={() => patch({ focalLength: f, concealed: false })}
                      >
                        {formatLength(f, 'cm', 0)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Slider
                label="Aperture ⌀"
                value={fromMeters(component.aperture, 'mm')}
                min={5}
                max={50}
                step={1}
                display={formatLength(component.aperture, 'mm', 0)}
                onChange={(value) => patch({ aperture: mm(value) })}
              />
              <div className="control-row">
                <span />
                <button className="chip" onClick={() => actions.useUnknownLens(component.id)}>
                  Use unknown lens
                </button>
                {component.concealed && (
                  <button className="chip" onClick={() => patch({ concealed: false })}>
                    Show focal length
                  </button>
                )}
              </div>
            </>
          )}

          {(component.kind === 'singleSlit' || component.kind === 'doubleSlit') && (
            <>
              <Slider
                label="Slit width a"
                value={fromMeters(component.width, 'mm')}
                min={0.02}
                max={0.5}
                step={0.005}
                display={formatLength(component.width, 'mm', 3)}
                onChange={(value) =>
                  patch(
                    component.kind === 'doubleSlit'
                      ? { width: mm(value), separation: Math.max(component.separation, mm(value + 0.02)) }
                      : { width: mm(value) },
                  )
                }
              />
              {component.kind === 'doubleSlit' && (
                <Slider
                  label="Separation d"
                  value={fromMeters(component.separation, 'mm')}
                  min={0.05}
                  max={1}
                  step={0.01}
                  display={formatLength(component.separation, 'mm', 2)}
                  // Slits must not overlap: d > a.
                  onChange={(value) => patch({ separation: Math.max(mm(value), component.width + mm(0.02)) })}
                />
              )}
              <OrientationControl value={component.orientation} onChange={(orientation) => patch({ orientation })} />
            </>
          )}

          {component.kind === 'object' && (
            <>
              <div className="control-row">
                <label>Shape</label>
                <div className="chip-group">
                  {OBJECT_SHAPES.map((shape) => (
                    <button key={shape} className={`chip${component.shape === shape ? ' active' : ''}`} onClick={() => patch({ shape })}>
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
              {component.shape === 'letter' && (
                <div className="control-row">
                  <label htmlFor="object-letter">Letter</label>
                  <input
                    id="object-letter"
                    className="text-input"
                    maxLength={1}
                    value={component.letter}
                    onChange={(event) => patch({ letter: event.target.value.toUpperCase() || 'F' })}
                  />
                </div>
              )}
              <Slider
                label="Height ho"
                value={fromMeters(component.height, 'mm')}
                min={5}
                max={40}
                step={1}
                display={formatLength(component.height, 'mm', 0)}
                onChange={(value) => patch({ height: mm(value) })}
              />
            </>
          )}

          <div className="control-row end">
            <button className="chip" onClick={() => actions.select(null)}>
              Done
            </button>
            <button className="chip danger" onClick={() => actions.removeComponent(component.id)}>
              Remove from bench
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
