import { useMemo, useState } from 'react'
import { experiment } from '../education/experiments'
import type { AnalysisContext } from '../education/experiments'
import { buildLabReport, formatWithUncertainty } from '../education/labReport'
import { analyzeMeasurement, fitRows, summarizeRows } from '../education/notebook'
import { agreement } from '../education/uncertainty'
import { formatNumber } from '../physics/units'
import { actions, theoryVisible, useLab } from '../state/labState'
import type { NotebookResult, NotebookRow } from '../state/labState'
import { createId } from '../state/presets'
import { NotebookPlot } from './NotebookPlot'
import type { ReportSection } from './report'

function parseNumber(text: string | undefined): number {
  const cleaned = (text ?? '').replace(',', '.').replace('−', '-')
  return cleaned.trim() === '' ? NaN : Number(cleaned)
}

const today = (): string => new Date().toISOString().slice(0, 10)

function download(content: string, type: string, name: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Comparison of a result with the accepted value, shown once the theory is visible. */
function Comparison({ result }: { result: Pick<NotebookResult, 'value' | 'uncertainty' | 'theory' | 'unit' | 'digits'> }) {
  if (result.theory === null) return null
  const verdict = agreement(result.value, result.uncertainty, result.theory)
  return (
    <span className="theory">
      accepted {formatNumber(result.theory, result.digits)} {result.unit}
      {Math.abs(result.theory) > 1e-9
        ? ` · error ${formatNumber((100 * Math.abs(result.value - result.theory)) / Math.abs(result.theory), 1)}%`
        : ` · deviation ${formatNumber(Math.abs(result.value - result.theory), result.digits)} ${result.unit}`}
      {verdict && ` · ${verdict}`}
    </span>
  )
}

interface Props {
  context: AnalysisContext
  /** Description of the current set-up, included in the exported report. */
  setup?: ReportSection[]
}

/** Experiment guide and lab notebook. */
export function ExperimentPanel({ context, setup = [] }: Props) {
  const experimentId = useLab((s) => s.experiment)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const notebook = useLab((s) => s.notebook)
  const [tab, setTab] = useState<'guide' | 'notebook'>('guide')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [student, setStudent] = useState('')
  const definition = experiment(experimentId)
  const rows = useMemo(() => notebook[experimentId] ?? [], [notebook, experimentId])
  const showTheory = theoryVisible({ mode, revealed })
  const summary = useMemo(() => summarizeRows(rows), [rows])
  const fitted = useMemo(() => fitRows(definition, rows, context), [definition, rows, context])
  const given = definition.given(context)

  const valueKey = (key: string) => `${experimentId}:${key}`
  const errorKey = (key: string) => `${experimentId}:${key}:Δ`
  const values: Record<string, number> = {}
  const uncertainties: Record<string, number> = {}
  let complete = true
  for (const field of definition.fields) {
    values[field.key] = parseNumber(inputs[valueKey(field.key)])
    // An empty uncertainty box means the reading uncertainty of the instrument.
    const entered = inputs[errorKey(field.key)]
    uncertainties[field.key] = entered === undefined || entered.trim() === '' ? field.uncertainty : Math.abs(parseNumber(entered))
    if (!Number.isFinite(values[field.key]) || !Number.isFinite(uncertainties[field.key])) complete = false
  }

  const record = () => {
    if (!complete) return
    const row: NotebookRow = {
      id: createId('row'),
      values,
      uncertainties,
      results: analyzeMeasurement(definition, values, uncertainties, context),
    }
    actions.addNotebookRow(row)
  }

  const exportCsv = () => {
    const header = [
      ...definition.fields.flatMap((f) => [`${f.label} (${f.unit})`, `Δ${f.label} (${f.unit})`]),
      ...(rows[0]?.results.flatMap((r) => [r.label, `Δ ${r.label}`, ...(showTheory ? [`${r.label} accepted`] : [])]) ?? []),
    ]
    const lines = rows.map((row) =>
      [
        ...definition.fields.flatMap((f) => [row.values[f.key], row.uncertainties[f.key] ?? 0]),
        ...row.results.flatMap((r) => [r.value, r.uncertainty ?? '', ...(showTheory ? [r.theory ?? ''] : [])]),
      ].join(','),
    )
    download([header.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','), ...lines].join('\n'), 'text/csv', `${experimentId}-notebook.csv`)
  }

  const exportReport = () => {
    const html = buildLabReport({
      definition,
      rows,
      summary,
      fit: fitted,
      given,
      // Calculated rows stay out of the report while the theory is withheld.
      setup: setup.map((section) => ({ title: section.title, rows: section.rows.filter((row) => showTheory || !row.theory) })),
      showTheory,
      student,
      date: today(),
    })
    download(html, 'text/html', `${experimentId}-report.html`)
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
          {given.length > 0 && <p className="given">Given: {given.map((g) => `${g.label} = ${g.value}`).join(' · ')}</p>}
          <form
            className="notebook-form"
            onSubmit={(event) => {
              event.preventDefault()
              record()
            }}
          >
            {definition.fields.map((field) => (
              <div key={field.key} className="notebook-field" title={field.hint}>
                <label>
                  <span>
                    {field.label} <em>({field.unit})</em>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder={field.hint ?? ''}
                    value={inputs[valueKey(field.key)] ?? ''}
                    onChange={(event) => setInputs((previous) => ({ ...previous, [valueKey(field.key)]: event.target.value }))}
                  />
                </label>
                <label className="notebook-error" title="Reading uncertainty of this measurement">
                  <span>±</span>
                  <input
                    inputMode="decimal"
                    aria-label={`Uncertainty of ${field.label} in ${field.unit}`}
                    placeholder={String(field.uncertainty)}
                    value={inputs[errorKey(field.key)] ?? ''}
                    onChange={(event) => setInputs((previous) => ({ ...previous, [errorKey(field.key)]: event.target.value }))}
                  />
                </label>
              </div>
            ))}
            <button type="submit" className="chip primary" disabled={!complete}>
              Record measurement
            </button>
          </form>
          <p className="hint">Each ± box holds the reading uncertainty of that measurement; leave it empty to use the instrument’s resolution shown in grey.</p>

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
                        <td key={field.key}>
                          {row.values[field.key]}
                          {(row.uncertainties[field.key] ?? 0) > 0 && <span className="plus-minus"> ± {row.uncertainties[field.key]}</span>}
                        </td>
                      ))}
                      {row.results.map((r) => (
                        <td key={r.label}>
                          <strong>{formatWithUncertainty(r.value, r.uncertainty, r.unit, r.digits)}</strong>
                          {showTheory && <Comparison result={r} />}
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
                {rows.length > 1 && summary.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={definition.fields.length + 1}>mean ± standard error ({rows.length} measurements)</td>
                      {rows[0].results.map((r) => {
                        // Only quantities that belong to the apparatus are averaged.
                        const entry = summary.find((candidate) => candidate.label === r.label)
                        return (
                          <td key={r.label}>
                            {entry && (
                              <>
                                <strong>{formatWithUncertainty(entry.statistics.mean, entry.statistics.standardError, entry.unit, entry.digits)}</strong>
                                {showTheory && (
                                  <Comparison
                                    result={{ value: entry.statistics.mean, uncertainty: entry.statistics.standardError, theory: entry.theory, unit: entry.unit, digits: entry.digits }}
                                  />
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {definition.plot && fitted && fitted.points.length > 0 && (
            <div className="notebook-graph">
              <NotebookPlot plot={definition.plot} data={fitted} />
              {fitted.fit && (
                <dl className="fit-results">
                  <div>
                    <dt>slope</dt>
                    <dd>{formatWithUncertainty(fitted.fit.slope, fitted.fit.slopeError, '', 4)}</dd>
                  </div>
                  <div>
                    <dt>intercept</dt>
                    <dd>{formatWithUncertainty(fitted.fit.intercept, fitted.fit.interceptError, '', 4)}</dd>
                  </div>
                  <div>
                    <dt>R²</dt>
                    <dd>{formatNumber(fitted.fit.r2, 4)}</dd>
                  </div>
                  {fitted.results.map((r) => (
                    <div key={r.label} className="derived">
                      <dt>{r.label}</dt>
                      <dd>
                        <strong>{formatWithUncertainty(r.value, r.uncertainty, r.unit, r.digits)}</strong>
                        {showTheory && <Comparison result={r} />}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
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
                <input className="text-input student-name" placeholder="Your name (for the report)" value={student} onChange={(event) => setStudent(event.target.value)} aria-label="Name for the report" />
                <button className="chip" onClick={exportReport} title="Download a printable lab report (HTML)">
                  Export report
                </button>
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
