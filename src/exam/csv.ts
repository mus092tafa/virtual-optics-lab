/**
 * Spreadsheet exchange: questions typed in Excel come in as CSV, and the
 * results of a sitting go out as CSV.
 */
import { newId, newOption } from './format'
import { questionScore, studentTotal } from './grading'
import type { ExamMaster, Question, SessionRecord } from './types'

/** Splits CSV text into rows of cells (RFC 4180 quoting; comma, semicolon or tab separated). */
export function parseCsv(source: string): string[][] {
  const text = source.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  // Excel writes semicolons in locales where the comma is the decimal mark.
  const delimiter = [',', ';', '\t'].reduce((best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best))
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell === '') quoted = true
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

export const QUESTION_CSV_TEMPLATE = [
  'type,question,points,answer,option1,option2,option3,option4',
  'mcq,"Which lens converges parallel light to a point?",1,1,Convex,Concave,Plane glass,',
  'written,"State the thin-lens equation and name each symbol.",3,"1/f = 1/do + 1/di",,,,',
].join('\r\n')

export interface QuestionImport {
  questions: Question[]
  /** Rows that could not be used, with the reason. */
  errors: string[]
}

/**
 * Reads written and multiple-choice questions from CSV with the columns
 * type, question, points, answer, option1, option2, … For a multiple-choice
 * question the answer is the number or letter of the correct option, or its text.
 */
export function importQuestions(source: string): QuestionImport {
  const rows = parseCsv(source)
  const errors: string[] = []
  const questions: Question[] = []
  if (rows.length === 0) return { questions, errors: ['The file is empty.'] }
  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const column = (name: string) => header.indexOf(name)
  const typeColumn = column('type')
  const promptColumn = column('question')
  if (typeColumn < 0 || promptColumn < 0) return { questions, errors: ['The first row must name the columns: type, question, points, answer, option1, option2, …'] }
  const pointsColumn = column('points')
  const answerColumn = column('answer')
  const optionColumns = header.map((name, index) => (/^option\s*\d+$/.test(name) ? index : -1)).filter((index) => index >= 0)

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2
    const cell = (at: number) => (at >= 0 ? (cells[at] ?? '').trim() : '')
    const type = cell(typeColumn).toLowerCase()
    const prompt = cell(promptColumn)
    const points = pointsColumn >= 0 && cell(pointsColumn) !== '' ? Number(cell(pointsColumn).replace(',', '.')) : 1
    if (!prompt) return void errors.push(`Row ${line}: the question text is empty.`)
    if (!(points > 0)) return void errors.push(`Row ${line}: the points must be a number greater than 0.`)
    const base = { id: newId('q'), prompt, points }
    if (type === 'written') {
      questions.push({ ...base, type: 'written', modelAnswer: cell(answerColumn) })
    } else if (type === 'mcq') {
      const options = optionColumns.map(cell).filter((value) => value !== '').map((value) => newOption(value))
      if (options.length < 2) return void errors.push(`Row ${line}: a multiple-choice question needs at least two options.`)
      const answer = cell(answerColumn)
      let correct = options.findIndex((option) => option.text.toLowerCase() === answer.toLowerCase())
      if (correct < 0 && /^\d+$/.test(answer)) correct = Number(answer) - 1
      if (correct < 0 && /^[a-z]$/i.test(answer)) correct = answer.toLowerCase().charCodeAt(0) - 97
      if (!options[correct]) return void errors.push(`Row ${line}: the answer "${answer}" does not match any option.`)
      questions.push({ ...base, type: 'mcq', options, correctOptionId: options[correct].id })
    } else {
      errors.push(`Row ${line}: unknown type "${cell(typeColumn)}" (use written or mcq; bench questions are created in the app).`)
    }
  })
  return { questions, errors }
}

/** One CSV cell; text that a spreadsheet would run as a formula is written as plain text. */
function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

const stamp = (time: number | null): string => (time === null ? '' : new Date(time).toISOString().replace('T', ' ').slice(0, 19))

/** The class list of a sitting with every student's marks, one row per student. */
export function resultsCsv(session: SessionRecord): string {
  const exam: ExamMaster = session.exam
  const header = [
    'Name',
    'Class',
    'Status',
    'Submitted (UTC)',
    ...exam.questions.map((question, index) => `Q${index + 1} (/${question.points})`),
    'Total',
    'Out of',
    'Percent',
    'Still to mark',
  ]
  const rows = session.students.map((student) => {
    const total = studentTotal(exam, student)
    return [
      student.name,
      student.className,
      student.status === 'submitted' ? (student.autoCollected ? 'collected at time limit' : 'submitted') : 'not submitted',
      stamp(student.submittedAt),
      ...exam.questions.map((question) => questionScore(question, student.answers[question.id], student.marks[question.id]).points ?? ''),
      total.score,
      total.max,
      total.max > 0 ? Math.round((1000 * total.score) / total.max) / 10 : 0,
      total.pending,
    ]
  })
  // A byte-order mark makes Excel read the file as UTF-8.
  return `﻿${[header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`
}
