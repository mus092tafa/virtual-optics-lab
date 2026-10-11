/**
 * Creating, checking and converting exam documents. Anything read from a file
 * or the network passes through a parser here before the application uses it.
 */
import type {
  Answer,
  Answers,
  AnswersFile,
  BenchKeyField,
  ExamMaster,
  ExamPaper,
  McqOption,
  PaperQuestion,
  Question,
  QuestionType,
} from './types'

export const FILE_EXTENSIONS = { master: 'opticsmaster', paper: 'opticsexam', answers: 'opticsanswers' } as const

export const DURATION_LIMITS = { min: 1, max: 600 } as const

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function newExam(): ExamMaster {
  return {
    format: 'optics-exam-master',
    version: 1,
    id: newId('exam'),
    title: 'Untitled exam',
    course: '',
    instructions: '',
    durationMinutes: 45,
    questions: [],
    updatedAt: Date.now(),
  }
}

export function newQuestion(type: QuestionType): Question {
  const base = { id: newId('q'), prompt: '', points: 1 }
  switch (type) {
    case 'written':
      return { ...base, type, modelAnswer: '' }
    case 'mcq': {
      const options = [newOption(), newOption(), newOption(), newOption()]
      return { ...base, type, options, correctOptionId: null }
    }
    case 'bench':
      return { ...base, type, setup: {}, fields: [newBenchField()], concealUnknowns: false, allowNotebook: false }
  }
}

export const newOption = (text = ''): McqOption => ({ id: newId('o'), text })

export const newBenchField = (): BenchKeyField => ({ id: newId('f'), label: '', unit: '', expected: null, tolerance: 0 })

/** The student's copy of an exam: every part of the answer key is left out. */
export function toPaper(exam: ExamMaster): ExamPaper {
  return {
    format: 'optics-exam',
    version: 1,
    id: exam.id,
    title: exam.title,
    course: exam.course,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    questions: exam.questions.map((question): PaperQuestion => {
      const { id, prompt, points } = question
      switch (question.type) {
        case 'written':
          return { id, prompt, points, type: 'written' }
        case 'mcq':
          return { id, prompt, points, type: 'mcq', options: question.options.map((option) => ({ id: option.id, text: option.text })) }
        case 'bench':
          return {
            id,
            prompt,
            points,
            type: 'bench',
            setup: question.setup,
            fields: question.fields.map((field) => ({ id: field.id, label: field.label, unit: field.unit })),
            concealUnknowns: question.concealUnknowns,
            allowNotebook: question.allowNotebook,
          }
      }
    }),
  }
}

/** Problems that would make an exam unusable in a sitting; empty when it is ready. */
export function examProblems(exam: ExamMaster): string[] {
  const problems: string[] = []
  if (!exam.title.trim()) problems.push('The exam has no title.')
  if (!(exam.durationMinutes >= DURATION_LIMITS.min && exam.durationMinutes <= DURATION_LIMITS.max)) {
    problems.push(`The exam time must be between ${DURATION_LIMITS.min} and ${DURATION_LIMITS.max} minutes.`)
  }
  if (exam.questions.length === 0) problems.push('The exam has no questions.')
  exam.questions.forEach((question, index) => {
    const name = `Question ${index + 1}`
    if (!question.prompt.trim()) problems.push(`${name} has no text.`)
    if (!(question.points > 0)) problems.push(`${name} must be worth more than 0 points.`)
    if (question.type === 'mcq') {
      if (question.options.filter((option) => option.text.trim()).length < 2) problems.push(`${name} needs at least two choices.`)
      if (question.options.some((option) => !option.text.trim())) problems.push(`${name} has an empty choice.`)
      if (!question.options.some((option) => option.id === question.correctOptionId)) problems.push(`${name} has no correct choice marked.`)
    }
    if (question.type === 'bench') {
      if (typeof question.setup.section !== 'string') problems.push(`${name} has no bench set-up.`)
      if (question.fields.some((field) => !field.label.trim())) problems.push(`${name} has an answer box without a label.`)
      if (question.fields.some((field) => field.expected !== null && !(field.tolerance >= 0))) problems.push(`${name} has a negative tolerance.`)
    }
  })
  return problems
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const finite = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

function parseQuestion(data: unknown, withKey: boolean): Question | null {
  if (!isObject(data) || typeof data.id !== 'string') return null
  const base = { id: data.id, prompt: text(data.prompt), points: Math.max(0, finite(data.points, 1)) }
  switch (data.type) {
    case 'written':
      return { ...base, type: 'written', modelAnswer: withKey ? text(data.modelAnswer) : '' }
    case 'mcq': {
      const options = (Array.isArray(data.options) ? data.options : [])
        .filter((option): option is Record<string, unknown> => isObject(option) && typeof option.id === 'string')
        .map((option) => ({ id: option.id as string, text: text(option.text) }))
      const correct = withKey && options.some((option) => option.id === data.correctOptionId) ? (data.correctOptionId as string) : null
      return { ...base, type: 'mcq', options, correctOptionId: correct }
    }
    case 'bench': {
      const fields = (Array.isArray(data.fields) ? data.fields : [])
        .filter((field): field is Record<string, unknown> => isObject(field) && typeof field.id === 'string')
        .map((field) => ({
          id: field.id as string,
          label: text(field.label),
          unit: text(field.unit),
          expected: withKey && typeof field.expected === 'number' && Number.isFinite(field.expected) ? field.expected : null,
          tolerance: withKey ? Math.abs(finite(field.tolerance, 0)) : 0,
        }))
      return {
        ...base,
        type: 'bench',
        setup: isObject(data.setup) ? data.setup : {},
        fields,
        concealUnknowns: data.concealUnknowns === true,
        allowNotebook: data.allowNotebook === true,
      }
    }
    default:
      return null
  }
}

function parseExam(data: unknown, withKey: boolean): ExamMaster | null {
  if (!isObject(data) || data.version !== 1 || typeof data.id !== 'string' || !Array.isArray(data.questions)) return null
  const questions = data.questions.map((question) => parseQuestion(question, withKey))
  if (questions.some((question) => question === null)) return null
  return {
    format: 'optics-exam-master',
    version: 1,
    id: data.id,
    title: text(data.title, 'Untitled exam'),
    course: text(data.course),
    instructions: text(data.instructions),
    durationMinutes: Math.min(DURATION_LIMITS.max, Math.max(DURATION_LIMITS.min, finite(data.durationMinutes, 45))),
    questions: questions as Question[],
    updatedAt: finite(data.updatedAt, Date.now()),
  }
}

/** Reads a teacher's exam (.opticsmaster); null when the data is not one. */
export function parseMaster(data: unknown): ExamMaster | null {
  return isObject(data) && data.format === 'optics-exam-master' ? parseExam(data, true) : null
}

/** Reads a student paper (.opticsexam); any answer key smuggled into it is dropped. */
export function parsePaper(data: unknown): ExamPaper | null {
  if (!isObject(data) || data.format !== 'optics-exam') return null
  const exam = parseExam(data, false)
  return exam && toPaper(exam)
}

function parseAnswer(data: unknown): Answer | null {
  if (!isObject(data)) return null
  switch (data.type) {
    case 'written':
      return { type: 'written', text: text(data.text) }
    case 'mcq':
      return { type: 'mcq', choice: typeof data.choice === 'string' ? data.choice : null }
    case 'bench': {
      const values: Record<string, string> = {}
      if (isObject(data.values)) for (const [key, value] of Object.entries(data.values)) values[key] = text(value)
      return { type: 'bench', values, notes: text(data.notes), lab: isObject(data.lab) ? data.lab : null }
    }
    default:
      return null
  }
}

export function parseAnswers(data: unknown): Answers {
  const answers: Answers = {}
  if (!isObject(data)) return answers
  for (const [id, value] of Object.entries(data)) {
    const answer = parseAnswer(value)
    if (answer) answers[id] = answer
  }
  return answers
}

export function parseAnswersFile(data: unknown): AnswersFile | null {
  if (!isObject(data) || data.format !== 'optics-answers' || data.version !== 1 || typeof data.examId !== 'string') return null
  return {
    format: 'optics-answers',
    version: 1,
    examId: data.examId,
    examTitle: text(data.examTitle),
    name: text(data.name),
    className: text(data.className),
    startedAt: finite(data.startedAt, 0),
    submittedAt: finite(data.submittedAt, 0),
    autoCollected: data.autoCollected === true,
    answers: parseAnswers(data.answers),
  }
}

export function parseJson(source: string): unknown {
  try {
    return JSON.parse(source)
  } catch {
    return null
  }
}

/** An answer with nothing in it yet, for a question the student has not touched. */
export function emptyAnswer(question: PaperQuestion): Answer {
  switch (question.type) {
    case 'written':
      return { type: 'written', text: '' }
    case 'mcq':
      return { type: 'mcq', choice: null }
    case 'bench':
      return { type: 'bench', values: {}, notes: '', lab: null }
  }
}

/** Has the student given any answer to the question? Work left on the bench alone does not count. */
export function isAnswered(question: PaperQuestion, answer: Answer | undefined): boolean {
  if (!answer || answer.type !== question.type) return false
  switch (answer.type) {
    case 'written':
      return answer.text.trim() !== ''
    case 'mcq':
      return answer.choice !== null
    case 'bench':
      return answer.notes.trim() !== '' || Object.values(answer.values).some((value) => value.trim() !== '')
  }
}

/** A name that is safe to use for a file on Windows. */
export function fileSafe(name: string): string {
  // oxlint-disable-next-line no-control-regex -- control characters are exactly what must go
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '')
  return cleaned.slice(0, 80) || 'untitled'
}

/** A paper in the shape of a teacher's exam, with an empty answer key, for code that handles both. */
export function masterFromPaper(paper: ExamPaper): ExamMaster {
  return parseExam({ ...paper, format: 'optics-exam-master' }, false)!
}
