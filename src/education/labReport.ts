/**
 * Builds the written lab report of an experiment as one self-contained HTML
 * document. Presentation only: every number comes from the notebook.
 */
import { formatNumber } from '../physics/units'
import type { NotebookResult, NotebookRow } from '../state/labState'
import type { ExperimentDefinition } from './experiments'
import type { NotebookFit, ResultSummary } from './notebook'
import { agreement, uncertaintyDigits } from './uncertainty'

export interface LabReportInput {
  definition: ExperimentDefinition
  rows: readonly NotebookRow[]
  summary: readonly ResultSummary[]
  fit: NotebookFit | null
  given: readonly { label: string; value: string }[]
  /** Set-up description: section title and labelled values. */
  setup: readonly { title: string; rows: readonly { label: string; value: string }[] }[]
  /** Accepted values are included only when the lab is showing them. */
  showTheory: boolean
  student: string
  date: string
}

/** Text as HTML text: nothing the student types can become markup. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** "10.02 ± 0.05 cm", with the number of decimals set by the uncertainty. */
export function formatWithUncertainty(value: number, uncertainty: number | null, unit: string, digits: number): string {
  const places = uncertaintyDigits(uncertainty, digits)
  const suffix = unit ? ` ${unit}` : ''
  if (uncertainty === null || !(uncertainty > 0)) return `${formatNumber(value, places)}${suffix}`
  return `${formatNumber(value, places)} ± ${formatNumber(uncertainty, places)}${suffix}`
}

function comparison(result: Pick<NotebookResult, 'value' | 'uncertainty' | 'theory' | 'unit' | 'digits'>): string {
  if (result.theory === null) return ''
  const accepted = `accepted ${formatNumber(result.theory, result.digits)}${result.unit ? ` ${result.unit}` : ''}`
  const verdict = agreement(result.value, result.uncertainty, result.theory)
  return verdict ? `${accepted}; ${verdict}` : accepted
}

/** The fitted graph as inline SVG (light background, for printing). */
function graphSvg(fit: NotebookFit, xLabel: string, yLabel: string): string {
  const width = 520
  const height = 300
  const margin = { left: 62, right: 16, top: 12, bottom: 44 }
  const xs = fit.points.map((p) => p.x)
  const ys = fit.points.map((p) => p.y)
  const pad = (min: number, max: number): [number, number] => {
    const span = max - min || Math.abs(max) || 1
    return [min - 0.08 * span, max + 0.08 * span]
  }
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs))
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys))
  const px = (x: number) => margin.left + ((x - x0) / (x1 - x0)) * (width - margin.left - margin.right)
  const py = (y: number) => height - margin.bottom - ((y - y0) / (y1 - y0)) * (height - margin.top - margin.bottom)
  const label = (value: number) => escapeHtml(Number(value.toPrecision(3)).toString())
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Graph of ${escapeHtml(yLabel)} against ${escapeHtml(xLabel)}">`,
    `<rect x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}" fill="none" stroke="#999"/>`,
  ]
  for (let i = 0; i <= 4; i++) {
    const x = x0 + ((x1 - x0) * i) / 4
    const y = y0 + ((y1 - y0) * i) / 4
    parts.push(
      `<text x="${px(x).toFixed(1)}" y="${height - margin.bottom + 16}" text-anchor="middle" font-size="11">${label(x)}</text>`,
      `<text x="${margin.left - 6}" y="${(py(y) + 4).toFixed(1)}" text-anchor="end" font-size="11">${label(y)}</text>`,
    )
  }
  parts.push(
    `<text x="${(margin.left + width - margin.right) / 2}" y="${height - 8}" text-anchor="middle" font-size="12">${escapeHtml(xLabel)}</text>`,
    `<text transform="translate(14 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)" text-anchor="middle" font-size="12">${escapeHtml(yLabel)}</text>`,
  )
  if (fit.fit) {
    const { slope, intercept } = fit.fit
    parts.push(
      `<line x1="${px(x0).toFixed(1)}" y1="${py(intercept + slope * x0).toFixed(1)}" x2="${px(x1).toFixed(1)}" y2="${py(intercept + slope * x1).toFixed(1)}" stroke="#1f6fd0" stroke-width="2" clip-path="none"/>`,
    )
  }
  for (const point of fit.points) {
    parts.push(`<circle cx="${px(point.x).toFixed(1)}" cy="${py(point.y).toFixed(1)}" r="4" fill="#111" stroke="#fff" stroke-width="1.5"/>`)
  }
  parts.push('</svg>')
  return parts.join('')
}

const list = (items: readonly string[], tag: 'ol' | 'ul'): string =>
  `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`

export function buildLabReport(input: LabReportInput): string {
  const { definition, rows, summary, fit, given, setup, showTheory, student, date } = input
  const body: string[] = []
  body.push(
    `<h1>Experiment ${definition.number} — ${escapeHtml(definition.title)}</h1>`,
    `<p class="meta">${student.trim() ? `${escapeHtml(student.trim())} · ` : ''}${escapeHtml(date)} · Virtual Optics Laboratory</p>`,
    `<h2>Aim</h2><p>${escapeHtml(definition.goal)}</p>`,
    `<h2>Procedure</h2>${list(definition.procedure, 'ol')}`,
    `<h2>Theory</h2>${list(definition.equations, 'ul')}`,
    `<h2>Model assumptions</h2>${list(definition.assumptions, 'ul')}`,
  )

  if (setup.length > 0 || given.length > 0) {
    body.push('<h2>Set-up</h2>')
    if (given.length > 0) {
      body.push(`<p>Given: ${given.map((g) => `${escapeHtml(g.label)} = ${escapeHtml(g.value)}`).join('; ')}</p>`)
    }
    for (const section of setup) {
      body.push(
        `<h3>${escapeHtml(section.title)}</h3><table class="pairs"><tbody>${section.rows
          .map((row) => `<tr><th>${escapeHtml(row.label.trim())}</th><td>${escapeHtml(row.value)}</td></tr>`)
          .join('')}</tbody></table>`,
      )
    }
  }

  body.push('<h2>Measurements and results</h2>')
  if (rows.length === 0) {
    body.push('<p>No measurements were recorded.</p>')
  } else {
    const head = [
      '<th>#</th>',
      ...definition.fields.map((field) => `<th>${escapeHtml(field.label)} (${escapeHtml(field.unit)})</th>`),
      ...rows[0].results.map((entry) => `<th>${escapeHtml(entry.label)}</th>`),
    ]
    const lines = rows.map((row, index) => {
      const cells = [
        `<td>${index + 1}</td>`,
        ...definition.fields.map((field) => {
          const delta = row.uncertainties[field.key] ?? 0
          return `<td>${escapeHtml(String(row.values[field.key]))}${delta > 0 ? ` ± ${escapeHtml(String(delta))}` : ''}</td>`
        }),
        ...row.results.map((entry) => {
          const note = showTheory ? comparison(entry) : ''
          return `<td>${escapeHtml(formatWithUncertainty(entry.value, entry.uncertainty, entry.unit, entry.digits))}${note ? `<br><small>${escapeHtml(note)}</small>` : ''}</td>`
        }),
      ]
      return `<tr>${cells.join('')}</tr>`
    })
    body.push(`<table><thead><tr>${head.join('')}</tr></thead><tbody>${lines.join('')}</tbody></table>`)

    if (rows.length > 1 && summary.length > 0) {
      body.push(
        `<h3>Mean of ${rows.length} measurements</h3><table class="pairs"><tbody>${summary
          .map((entry) => {
            const { mean, standardError } = entry.statistics
            const note = showTheory ? comparison({ value: mean, uncertainty: standardError, theory: entry.theory, unit: entry.unit, digits: entry.digits }) : ''
            return `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(formatWithUncertainty(mean, standardError, entry.unit, entry.digits))}${note ? ` <small>(${escapeHtml(note)})</small>` : ''}</td></tr>`
          })
          .join('')}</tbody></table><p><small>The uncertainty of the mean is the standard error s/√n of the recorded values.</small></p>`,
      )
    }
  }

  if (fit && definition.plot && fit.points.length > 0) {
    body.push(`<h2>Graph</h2>${graphSvg(fit, definition.plot.xLabel, definition.plot.yLabel)}<p>${escapeHtml(definition.plot.relation)}</p>`)
    if (fit.fit) {
      const line = fit.fit
      body.push(
        `<table class="pairs"><tbody><tr><th>Slope</th><td>${escapeHtml(formatWithUncertainty(line.slope, line.slopeError, '', 4))}</td></tr><tr><th>Intercept</th><td>${escapeHtml(formatWithUncertainty(line.intercept, line.interceptError, '', 4))}</td></tr><tr><th>R²</th><td>${formatNumber(line.r2, 4)} (${line.count} points)</td></tr>${fit.results
          .map((entry) => {
            const note = showTheory ? comparison(entry) : ''
            return `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(formatWithUncertainty(entry.value, entry.uncertainty, entry.unit, entry.digits))}${note ? ` <small>(${escapeHtml(note)})</small>` : ''}</td></tr>`
          })
          .join('')}</tbody></table>`,
      )
    } else {
      body.push('<p>At least three measurements are needed to fit a line.</p>')
    }
  }

  body.push('<h2>Conclusion</h2><div class="blank"></div>')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Experiment ${definition.number} — ${escapeHtml(definition.title)}</title>
<style>
  body { font: 14px/1.5 Georgia, 'Times New Roman', serif; color: #111; background: #fff; max-width: 760px; margin: 32px auto; padding: 0 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 22px 0 6px; border-bottom: 1px solid #bbb; padding-bottom: 2px; }
  h3 { font-size: 14px; margin: 14px 0 4px; }
  .meta { color: #555; margin: 0; }
  table { border-collapse: collapse; margin: 6px 0; }
  th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; vertical-align: top; }
  thead th { background: #eee; }
  table.pairs th { font-weight: normal; background: #f6f6f6; }
  small { color: #444; }
  .blank { height: 120px; border: 1px dashed #bbb; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${body.join('\n')}
</body>
</html>
`
}
