/**
 * Printable documents of the exam mode, each one self-contained HTML that the
 * desktop shell turns into a PDF: the question paper, a student's answer
 * sheet and the results of a sitting. Presentation only.
 */
import { escapeHtml } from '../education/labReport'
import { fieldCorrect, questionScore, studentTotal } from './grading'
import type { Answer, ExamMaster, ExamPaper, PaperQuestion, Question, SessionRecord, StudentRecord } from './types'

const STYLE = `
  @page { size: A4; margin: 16mm; }
  body { font: 11pt/1.45 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2pt; }
  h2 { font-size: 11.5pt; margin: 0 0 4pt; }
  .sub { color: #555; margin: 0 0 10pt; }
  .meta { display: flex; flex-wrap: wrap; gap: 4pt 22pt; border: 1px solid #bbb; border-radius: 4pt; padding: 7pt 10pt; margin-bottom: 12pt; }
  .meta b { font-weight: 600; }
  .question { border-top: 1px solid #ccc; padding: 9pt 0; break-inside: avoid; }
  .prompt, .answer, .notes { white-space: pre-wrap; overflow-wrap: anywhere; }
  .points { float: right; color: #555; font-size: 10pt; }
  ol.options { list-style: upper-alpha; margin: 5pt 0 0; padding-left: 22pt; }
  ol.options li.chosen { font-weight: 600; }
  ol.options li.correct::after { content: '  ✓ correct'; color: #1a7f37; font-weight: 600; }
  .box { border: 1px solid #bbb; border-radius: 3pt; padding: 6pt 8pt; margin-top: 5pt; min-height: 16pt; }
  .blank { color: #888; font-style: italic; }
  .lines { height: 70pt; border-bottom: 1px solid #ccc; }
  .key { color: #1a7f37; margin-top: 5pt; }
  .mark { margin-top: 5pt; color: #0b4aa2; }
  .wrong { color: #b42318; }
  .right { color: #1a7f37; }
  table { border-collapse: collapse; width: 100%; margin-top: 5pt; font-size: 10pt; }
  th, td { border: 1px solid #bbb; padding: 3pt 6pt; text-align: left; }
  th { background: #f1f3f5; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .total { font-size: 13pt; font-weight: 600; margin-top: 10pt; text-align: right; }
`

const page = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`

const points = (value: number): string => `${value} ${value === 1 ? 'point' : 'points'}`

const dateTime = (time: number | null): string =>
  time === null ? '—' : new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const TYPE_NAMES: Record<PaperQuestion['type'], string> = { written: 'Written', mcq: 'Multiple choice', bench: 'Laboratory bench' }

function heading(exam: ExamPaper | ExamMaster, subtitle: string): string {
  return `<h1>${escapeHtml(exam.title)}</h1><p class="sub">${escapeHtml([exam.course, subtitle].filter(Boolean).join(' · '))}</p>`
}

function questionHeading(question: PaperQuestion, index: number, suffix = ''): string {
  return `<span class="points">${escapeHtml(suffix || points(question.points))}</span><h2>Question ${index + 1} · ${TYPE_NAMES[question.type]}</h2><div class="prompt">${escapeHtml(question.prompt)}</div>`
}

/** The question paper. With `key`, the teacher's copy including the answer key. */
export function examPaperHtml(exam: ExamMaster | ExamPaper, options: { key: boolean }): string {
  const withKey = options.key && exam.format === 'optics-exam-master'
  const total = exam.questions.reduce((sum, question) => sum + question.points, 0)
  const body = [
    heading(exam, withKey ? 'Answer key — teacher’s copy' : 'Question paper'),
    `<div class="meta"><span><b>Time allowed:</b> ${exam.durationMinutes} min</span><span><b>Questions:</b> ${exam.questions.length}</span><span><b>Total:</b> ${points(total)}</span>${
      withKey ? '' : '<span><b>Name:</b> ______________________</span><span><b>Class:</b> ____________</span>'
    }</div>`,
    exam.instructions.trim() ? `<p class="prompt">${escapeHtml(exam.instructions)}</p>` : '',
  ]
  exam.questions.forEach((question, index) => {
    const parts = [questionHeading(question, index)]
    const keyed = withKey ? (question as Question) : null
    if (question.type === 'mcq') {
      const correct = keyed?.type === 'mcq' ? keyed.correctOptionId : null
      parts.push(`<ol class="options">${question.options.map((option) => `<li${option.id === correct ? ' class="correct"' : ''}>${escapeHtml(option.text)}</li>`).join('')}</ol>`)
    } else if (question.type === 'written') {
      parts.push(keyed?.type === 'written' ? `<div class="key"><b>Model answer:</b> <span class="answer">${escapeHtml(keyed.modelAnswer || '—')}</span></div>` : '<div class="lines"></div>')
    } else {
      const rows = question.fields.map((field) => {
        const key = keyed?.type === 'bench' ? keyed.fields.find((candidate) => candidate.id === field.id) : undefined
        const accepted = key ? (key.expected === null ? 'marked by hand' : `${key.expected} ± ${key.tolerance}`) : ''
        return `<tr><td>${escapeHtml(field.label)}</td><td>${escapeHtml(field.unit)}</td><td>${escapeHtml(accepted)}</td></tr>`
      })
      parts.push(
        '<p class="sub">Carried out on the virtual bench in the laboratory application.</p>',
        `<table><tr><th>Quantity</th><th>Unit</th><th>${withKey ? 'Accepted value' : 'Your value'}</th></tr>${rows.join('')}</table>`,
      )
    }
    body.push(`<div class="question">${parts.join('')}</div>`)
  })
  return page(exam.title, body.join(''))
}

function answerBody(question: Question, answer: Answer | undefined, graded: boolean): string {
  if (question.type === 'mcq') {
    const choice = answer?.type === 'mcq' ? answer.choice : null
    const items = question.options.map((option) => {
      const classes = [option.id === choice ? 'chosen' : '', graded && option.id === question.correctOptionId ? 'correct' : ''].filter(Boolean).join(' ')
      return `<li class="${classes}">${option.id === choice ? '● ' : ''}${escapeHtml(option.text)}</li>`
    })
    return `<ol class="options">${items.join('')}</ol>${choice === null ? '<p class="blank">No choice made.</p>' : ''}`
  }
  if (question.type === 'written') {
    const text = answer?.type === 'written' ? answer.text : ''
    const model = graded && question.modelAnswer.trim() ? `<div class="key"><b>Model answer:</b> <span class="answer">${escapeHtml(question.modelAnswer)}</span></div>` : ''
    return `<div class="box answer">${text.trim() ? escapeHtml(text) : '<span class="blank">No answer.</span>'}</div>${model}`
  }
  const values = answer?.type === 'bench' ? answer.values : {}
  const rows = question.fields.map((field) => {
    const typed = values[field.id] ?? ''
    const correct = graded ? fieldCorrect(field, typed) : null
    const verdict = correct === null ? '' : correct ? '<span class="right">within tolerance</span>' : '<span class="wrong">outside tolerance</span>'
    const accepted = graded ? `<td>${field.expected === null ? '—' : `${field.expected} ± ${field.tolerance}`}</td><td>${verdict}</td>` : ''
    return `<tr><td>${escapeHtml(field.label)}</td><td>${typed.trim() ? escapeHtml(typed) : '<span class="blank">blank</span>'}</td><td>${escapeHtml(field.unit)}</td>${accepted}</tr>`
  })
  const notes = answer?.type === 'bench' ? answer.notes : ''
  return [
    `<table><tr><th>Quantity</th><th>Student’s value</th><th>Unit</th>${graded ? '<th>Accepted</th><th>Check</th>' : ''}</tr>${rows.join('')}</table>`,
    notes.trim() ? `<div class="box notes">${escapeHtml(notes)}</div>` : '',
  ].join('')
}

export interface AnswerSheetOptions {
  /** Include the answer key, the marks and the teacher's comments. */
  graded: boolean
  roomName?: string
}

/** One student's answers, optionally with the marking. */
export function answerSheetHtml(exam: ExamMaster, student: Pick<StudentRecord, 'name' | 'className' | 'submittedAt' | 'autoCollected' | 'answers' | 'marks'>, options: AnswerSheetOptions): string {
  const total = studentTotal(exam, student)
  const body = [
    heading(exam, options.graded ? 'Marked answer sheet' : 'Answer sheet'),
    `<div class="meta"><span><b>Name:</b> ${escapeHtml(student.name)}</span><span><b>Class:</b> ${escapeHtml(student.className)}</span>${
      options.roomName ? `<span><b>Sitting:</b> ${escapeHtml(options.roomName)}</span>` : ''
    }<span><b>${student.autoCollected ? 'Collected at time limit' : 'Submitted'}:</b> ${escapeHtml(dateTime(student.submittedAt))}</span></div>`,
  ]
  exam.questions.forEach((question, index) => {
    const answer = student.answers[question.id]
    const mark = student.marks[question.id]
    const score = questionScore(question, answer, mark)
    const suffix = options.graded ? `${score.points === null ? '—' : score.points} / ${question.points}` : ''
    const parts = [questionHeading(question, index, suffix), answerBody(question, answer, options.graded)]
    if (options.graded && score.points === null) parts.push('<div class="mark">Not marked yet.</div>')
    if (options.graded && mark?.comment.trim()) parts.push(`<div class="mark"><b>Teacher’s comment:</b> <span class="answer">${escapeHtml(mark.comment)}</span></div>`)
    body.push(`<div class="question">${parts.join('')}</div>`)
  })
  if (options.graded) {
    const pending = total.pending > 0 ? ` (${total.pending} ${total.pending === 1 ? 'question' : 'questions'} still to mark)` : ''
    body.push(`<p class="total">Total: ${total.score} / ${total.max}${pending}</p>`)
  }
  return page(`${exam.title} — ${student.name}`, body.join(''))
}

/** The class list of a sitting with the marks of every student. */
export function resultsHtml(session: SessionRecord): string {
  const exam = session.exam
  const rows = session.students.map((student) => {
    const total = studentTotal(exam, student)
    const cells = exam.questions.map((question) => {
      const score = questionScore(question, student.answers[question.id], student.marks[question.id])
      return `<td class="num">${score.points === null ? '—' : score.points}</td>`
    })
    const percent = total.max > 0 ? `${Math.round((1000 * total.score) / total.max) / 10}%` : '—'
    const status = student.status === 'submitted' ? (student.autoCollected ? 'collected' : 'submitted') : 'not submitted'
    return `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.className)}</td><td>${status}</td>${cells.join('')}<td class="num"><b>${total.score}</b> / ${total.max}${total.pending > 0 ? ' *' : ''}</td><td class="num">${percent}</td></tr>`
  })
  const body = [
    heading(exam, 'Results'),
    `<div class="meta"><span><b>Sitting:</b> ${escapeHtml(session.roomName)}</span><span><b>Started:</b> ${escapeHtml(dateTime(session.startedAt ?? session.createdAt))}</span><span><b>Students:</b> ${session.students.length}</span><span><b>Time allowed:</b> ${exam.durationMinutes} min</span></div>`,
    `<table><tr><th>Name</th><th>Class</th><th>Status</th>${exam.questions.map((question, index) => `<th>Q${index + 1} /${question.points}</th>`).join('')}<th>Total</th><th>%</th></tr>${rows.join('')}</table>`,
    '<p class="sub">* some questions are still to be marked; the total counts them as 0.</p>',
  ]
  return page(`${exam.title} — results`, body.join(''))
}
