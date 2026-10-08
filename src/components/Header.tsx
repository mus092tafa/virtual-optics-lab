import { useEffect, useRef, useState } from 'react'
import { EXPERIMENTS } from '../education/experiments'
import { actions, useLab } from '../state/labState'
import type { LabMode } from '../state/labState'
import { SWEEP_LABELS, applySweep } from '../state/sweeps'

const MODES: { id: LabMode; label: string; title: string }[] = [
  { id: 'experiment', label: 'Experiment', title: 'Calculated results are withheld until you ask for them' },
  { id: 'learning', label: 'Learning', title: 'All values, equations and model assumptions are shown' },
  { id: 'demonstration', label: 'Demonstration', title: 'Everything shown, with an automatic parameter sweep' },
]
const SWEEP_PERIOD_MS = 9000

export function Header() {
  const section = useLab((s) => s.section)
  const experimentId = useLab((s) => s.experiment)
  const mode = useLab((s) => s.mode)
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [sweeping, setSweeping] = useState(false)

  // Demonstration sweep: a triangle wave on the experiment's key parameter.
  useEffect(() => {
    if (!sweeping || mode !== 'demonstration') return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const phase = ((now - start) % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS
      applySweep(experimentId, phase < 0.5 ? phase * 2 : 2 - phase * 2)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sweeping, mode, experimentId])

  const flash = (text: string) => {
    setStatus(text)
    window.setTimeout(() => setStatus(''), 2500)
  }

  const save = () => {
    const blob = new Blob([actions.exportConfiguration()], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `optics-lab-${experimentId}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    flash('Configuration saved')
  }

  const load = async (file: File | undefined) => {
    if (!file) return
    flash(actions.importConfiguration(await file.text()) ? 'Configuration loaded' : 'Not a valid lab configuration file')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3 Q25 16 16 29 Q7 16 16 3Z" fill="none" stroke="#7cc4ff" strokeWidth="1.8" />
            <path d="M1 11 L16 11 L31 19 M1 21 L16 21 L31 13" stroke="#ff5a4f" strokeWidth="1.4" fill="none" />
          </svg>
          <div>
            <h1>Virtual Optics Laboratory</h1>
            <p>Physically modelled optical bench for engineering students</p>
          </div>
        </div>

        <nav className="segmented" aria-label="Laboratory section">
          <button className={section === 'surface' ? 'active' : ''} onClick={() => actions.setSection('surface')}>
            A · Reflection &amp; Refraction
          </button>
          <button className={section === 'bench' ? 'active' : ''} onClick={() => actions.setSection('bench')}>
            B · Optical Bench
          </button>
        </nav>

        <div className="segmented" role="radiogroup" aria-label="Mode">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              role="radio"
              aria-checked={mode === entry.id}
              className={mode === entry.id ? 'active' : ''}
              title={entry.title}
              onClick={() => {
                setSweeping(false)
                actions.setMode(entry.id)
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="toolbar">
          {status && (
            <span className="status" role="status">
              {status}
            </span>
          )}
          <button className="chip" onClick={() => actions.resetLaboratory()} title="Restore the current experiment's initial layout">
            Reset
          </button>
          {section === 'bench' && (
            <button className="chip" onClick={() => actions.clearBench()} title="Remove every component from the bench">
              Clear all
            </button>
          )}
          <button className="chip" onClick={save} title="Download the configuration as a file">
            Save
          </button>
          <button className="chip" onClick={() => fileInput.current?.click()} title="Load a saved configuration file">
            Load
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => load(event.target.files?.[0])} />
        </div>
      </div>

      <div className="header-presets">
        <span className="presets-label">Experiments</span>
        {EXPERIMENTS.map((entry) => (
          <button
            key={entry.id}
            className={`preset${entry.id === experimentId ? ' active' : ''}`}
            onClick={() => {
              setSweeping(false)
              actions.loadExperiment(entry.id)
            }}
            title={entry.goal}
          >
            <span className="preset-number">{entry.number}</span>
            {entry.short}
          </button>
        ))}
        {mode === 'demonstration' && (
          <button className={`chip sweep${sweeping ? ' active' : ''}`} onClick={() => setSweeping((value) => !value)}>
            {sweeping ? '■ Stop sweep' : `▶ Sweep ${SWEEP_LABELS[experimentId]}`}
          </button>
        )}
      </div>
    </header>
  )
}
