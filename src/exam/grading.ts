/**
 * Marking. Multiple-choice answers and bench values with an accepted value are
 * checked automatically; everything else waits for the teacher, whose mark
 * always takes precedence over the automatic one.
 */
import type { Answer, BenchKeyField, ExamMaster, Mark, Question, StudentRecord } from './types'

/** Reads a number as a student types it: decimal comma and a typographic minus are accepted. */
export function parseNumber(source: string | undefined): number {
  const cleaned = (source ?? '').trim().replace(',', '.').replace('−', '-')
  return cleaned === '' ? NaN : Number(cleaned)
}

const round = (points: number): number => Math.round(points * 100) / 100

/** Is the typed value within the tolerance of the accepted one? Null when there is nothing to check against. */
export function fieldCorrect(field: BenchKeyField, typed: string | undefined): boolean | null {
  if (field.expected === null) return null
  const value = parseNumber(typed)
  if (!Number.isFinite(value)) return false
  // A relative allowance of a few ulps keeps values on the limit from failing on rounding.
  return Math.abs(value - field.expected) <= field.tolerance + 1e-9 * Math.max(1, Math.abs(field.expected))
}

export interface AutoMark {
  points: number
  /** False when part of the question still has to be judged by the teacher. */
  complete: boolean
}

/** The mark that follows from the answer key alone; null when the key says nothing. */
export function autoMark(question: Question, answer: Answer | undefined): AutoMark | null {
  switch (question.type) {
    case 'written':
      return null
    case 'mcq':
      if (question.correctOptionId === null) return null
      return { points: answer?.type === 'mcq' && answer.choice === question.correctOptionId ? question.points : 0, complete: true }
    case 'bench': {
      const checked = question.fields.filter((field) => field.expected !== null)
      if (checked.length === 0) return null
      const values = answer?.type === 'bench' ? answer.values : {}
      const share = question.points / question.fields.length
      const correct = checked.filter((field) => fieldCorrect(field, values[field.id])).length
      return { points: round(correct * share), complete: checked.length === question.fields.length }
    }
  }
}

/** Stable text form of an answer, ignoring the bench layout, to detect that it changed after marking. */
export function answerDigest(answer: Answer | undefined): string {
  if (!answer) return ''
  switch (answer.type) {
    case 'written':
      return answer.text
    case 'mcq':
      return answer.choice ?? ''
    case 'bench':
      return JSON.stringify([Object.entries(answer.values).sort(([a], [b]) => a.localeCompare(b)), answer.notes])
  }
}

export interface QuestionScore {
  /** Null while the question still needs the teacher. */
  points: number | null
  source: 'teacher' | 'auto' | 'pending'
  /** The answer was changed after the teacher marked it. */
  stale: boolean
}

export function questionScore(question: Question, answer: Answer | undefined, mark: Mark | undefined): QuestionScore {
  if (mark) return { points: mark.points, source: 'teacher', stale: mark.answerDigest !== answerDigest(answer) }
  const auto = autoMark(question, answer)
  if (auto?.complete) return { points: auto.points, source: 'auto', stale: false }
  return { points: null, source: 'pending', stale: false }
}

export interface StudentTotal {
  score: number
  max: number
  /** Questions that still need marking, including ones resubmitted since they were marked. */
  pending: number
}

export function studentTotal(exam: ExamMaster, student: Pick<StudentRecord, 'answers' | 'marks'>): StudentTotal {
  let score = 0
  let pending = 0
  for (const question of exam.questions) {
    const result = questionScore(question, student.answers[question.id], student.marks[question.id])
    if (result.points === null || result.stale) pending++
    score += result.points ?? 0
  }
  return { score: round(score), max: maxPoints(exam), pending }
}

export function maxPoints(exam: { questions: readonly { points: number }[] }): number {
  return round(exam.questions.reduce((sum, question) => sum + question.points, 0))
}

/** A mark kept within the points the question is worth. */
export function clampPoints(points: number, question: Pick<Question, 'points'>): number {
  return Number.isFinite(points) ? round(Math.min(question.points, Math.max(0, points))) : 0
}
