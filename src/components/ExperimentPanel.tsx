import { useState } from 'react'
import { experiment } from '../education/experiments'
import type { AnalysisContext } from '../education/experiments'
import { formatNumber } from '../physics/units'
import { actions, theoryVisible, useLab } from '../state/labState'
import type { NotebookRow } from '../state/labState'
import { createId } from '../state/presets'

/** Experiment guide and lab notebook. */
export function ExperimentPanel({ context }: { context: AnalysisContext }) {
  const experimentId = useLab((s) => s.experiment)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const notebook = useLab((s) => s.notebook)
  const [tab, setTab] = useState<'guide' | 'notebook'>('guide')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const definition = experiment(experimentId)
  const rows = notebook[experimentId] ?? []
  const showTheory = theoryVisible({ mode, revealed })

  const values: Record<string, number> = {}
  let complete = true
  for (const field of definition.fields) {
    const text = (inputs[`${experimentId}:${field.key}`] ?? '').replace(',', '.').replace('−', '-')
    const number = Number(text)
    if (text.trim() === '' || !Number.isFinite(number)) complete = false
    values[field.key] = number
  }

  const record = () => {
    if (!complete) return
    const row: NotebookRow = { id: createId('row'), values, results: definition.analyze(values, context) }
    actions.addNotebookRow(row)
  }

  const exportCsv = () => {
    const header = [...definition.fields.map((f) => `${f.label} (${f.unit})`), ...(rows[0]?.results.flatMap((r) => [r.label, `${r.label} accepted`]) ?? [])]
    const lines = rows.map((row) =>
      [...definition.fields.map((f) => row.values[f.key]), ...row.results.flatMap((r) => [r.value, r.theory ?? ''])].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${experimentId}-notebook.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="panel experiment" aria-label="Experiment">
      <header className="panel-header">
        <h2>
          Experiment {definition.number} — {definition.title}
        </h2>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'guide'} className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
            Guide
          </button>
          <button role="tab" aria-selected={tab === 'notebook'} className={tab === 'notebook' ? 'active' : ''} onClick={() => setTab('notebook')}>
            Notebook{rows.length ? ` (${rows.length})` : ''}
          </button>
        </div>
      </header>

      {tab === 'guide' && (
        <div className="guide">
          <p className="goal">{definition.goal}</p>
          <ol>
            {definition.procedure.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {mode !== 'experiment' && (
            <>
              <h3>Equations</h3>
              <ul className="equations">
                {definition.equations.map((equation) => (
                  <li key={equation}>{equation}</li>
                ))}
              </ul>
              <h3>Model assumptions</h3>
              <ul className="assumptions">
                {definition.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </>
          )}
          {mode === 'experiment' && <p className="hint">Experiment mode: calculated results are withheld. Measure, record, then reveal the theory to check your work.</p>}
        </div>
      )}

      {tab === 'notebook' && (
        <div className="notebook">
          {definition.given(context).length > 0 && (
            <p className="given">
              Given:{' '}
              {definition
                .given(context)
                .map((g) => `${g.label} = ${g.value}`)
                .join(' · ')}
            </p>
          )}
          <form
            className="notebook-form"
            onSubmit={(event) => {
              event.preventDefault()
              record()
            }}
          >
            {definition.fields.map((field) => (
              <label key={field.key} title={field.hint}>
                <span>
                  {field.label} <em>({field.unit})</em>
                </span>
                <input
                  inputMode="decimal"
                  placeholder={field.hint ?? ''}
                  value={inputs[`${experimentId}:${field.key}`] ?? ''}
                  onChange={(event) => setInputs((previous) => ({ ...previous, [`${experimentId}:${field.key}`]: event.target.value }))}
                />
              </label>
            ))}
            <button type="submit" className="chip primary" disabled={!complete}>
              Record measurement
            </button>
          </form>

          {rows.length === 0 ? (
            <p className="empty">No measurements yet. Enter the values you measured on the bench and screen, then record them.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    {definition.fields.map((field) => (
                      <th key={field.key}>
                        {field.label} ({field.unit})
                      </th>
                    ))}
                    {rows[0].results.map((r) => (
                      <th key={r.label}>{r.label}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      {definition.fields.map((field) => (
                        <td key={field.key}>{row.values[field.key]}</td>
                      ))}
                      {row.results.map((r) => (
                        <td key={r.label}>
                          <strong>
                            {formatNumber(r.value, r.digits)} {r.unit}
                          </strong>
                          {showTheory && r.theory !== null && (
                            <span className="theory">
                              accepted {formatNumber(r.theory, r.digits)} {r.unit}
                              {Math.abs(r.theory) > 1e-9
                                ? ` · error ${formatNumber((100 * Math.abs(r.value - r.theory)) / Math.abs(r.theory), 1)}%`
                                : ` · deviation ${formatNumber(Math.abs(r.value - r.theory), r.digits)} ${r.unit}`}
                            </span>
                          )}
                        </td>
                      ))}
                      <td>
                        <button className="icon-button" aria-label={`Delete measurement ${index + 1}`} onClick={() => actions.removeNotebookRow(row.id)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="control-row end">
            {mode === 'experiment' && rows.length > 0 && (
              <button className="chip" onClick={() => actions.setRevealed(!revealed)}>
                {revealed ? 'Hide accepted values' : 'Check against theory'}
              </button>
            )}
            {rows.length > 0 && (
              <>
                <button className="chip" onClick={exportCsv}>
                  Export CSV
                </button>
                <button className="chip" onClick={() => actions.clearNotebook()}>
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
