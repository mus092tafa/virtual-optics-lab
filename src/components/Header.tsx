import { useEffect, useRef, useState } from 'react'
import { experiment } from '../education/experiments'
import { TOPICS, topicOf } from '../education/topics'
import { actions, useLab } from '../state/labState'
import type { LabMode } from '../state/labState'
import { SWEEP_LABELS, applySweep } from '../state/sweeps'
import { resetPanelLayouts } from './hooks'
import { BrandMark } from './exam/BrandMark'

const MODES: { id: LabMode; label: string; title: string }[] = [
  { id: 'experiment', label: 'Experiment', title: 'Calculated results are withheld until you ask for them' },
  { id: 'learning', label: 'Learning', title: 'All values, equations and model assumptions are shown' },
  { id: 'demonstration', label: 'Demonstration', title: 'Everything shown, with an automatic parameter sweep' },
]
const SWEEP_PERIOD_MS = 9000

interface Props {
  /** Shown as a button that leaves the laboratory, when given. */
  onHome?: () => void
}

export function Header({ onHome }: Props) {
  const section = useLab((s) => s.section)
  const experimentId = useLab((s) => s.experiment)
  const mode = useLab((s) => s.mode)
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [sweeping, setSweeping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const topic = topicOf(experimentId)

  // The menu closes when the student clicks elsewhere or presses Escape.
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [menuOpen])

  const open = (id: typeof experimentId) => {
    setSweeping(false)
    actions.loadExperiment(id)
  }

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
          {onHome && (
            <button className="chip" onClick={onHome} title="Back to the start screen">
              ← Start
            </button>
          )}
          <BrandMark />
          <div>
            <h1>Virtual Optics Laboratory</h1>
            <p>Physically modelled optical bench for engineering students</p>
          </div>
        </div>

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
          <div className="menu" ref={menu}>
            <button className={`chip${menuOpen ? ' active' : ''}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
              More ▾
            </button>
            {menuOpen && (
              <div className="menu-list" role="menu" onClick={() => setMenuOpen(false)}>
                {section === 'bench' && (
                  <button role="menuitem" onClick={() => actions.clearBench()}>
                    <strong>Clear the bench</strong>
                    <span>Remove every component from the rail</span>
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    resetPanelLayouts()
                    flash('Panel sizes reset')
                  }}
                >
                  <strong>Reset the panel sizes</strong>
                  <span>Undo every section you dragged larger or smaller</span>
                </button>
                <button role="menuitem" onClick={save}>
                  <strong>Save to a file…</strong>
                  <span>Download this set-up</span>
                </button>
                <button role="menuitem" onClick={() => fileInput.current?.click()}>
                  <strong>Load from a file…</strong>
                  <span>Open a set-up saved earlier</span>
                </button>
              </div>
            )}
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => load(event.target.files?.[0])} />
        </div>
      </div>

      {/* Two levels: the topics as tabs, and under them the experiments of the open topic in that topic's colour. */}
      <nav className="topic-tabs" aria-label="Topic">
        {TOPICS.map((entry) => (
          <button
            key={entry.id}
            data-topic={entry.id}
            className={`topic-tab${entry.id === topic.id ? ' active' : ''}`}
            aria-current={entry.id === topic.id ? 'true' : undefined}
            title={entry.experiments.map((id) => experiment(id).short).join(' · ')}
            // Choosing a topic opens its first experiment; the one in progress is left alone.
            onClick={() => entry.id !== topic.id && open(entry.experiments[0])}
          >
            <span className="topic-dot" aria-hidden="true" />
            {entry.name}
            <span className="topic-count">{entry.experiments.length}</span>
          </button>
        ))}
      </nav>
      <div className="topic-experiments" data-topic={topic.id} role="group" aria-label={`Experiments in ${topic.name}`}>
        <span className="topic-experiments-label">Experiments</span>
        {topic.experiments.map(experiment).map((entry) => (
          <button key={entry.id} className={`preset${entry.id === experimentId ? ' active' : ''}`} aria-current={entry.id === experimentId ? 'true' : undefined} onClick={() => open(entry.id)} title={entry.goal}>
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
