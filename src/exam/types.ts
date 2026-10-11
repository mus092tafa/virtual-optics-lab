/**
 * Data model of the exam mode: the exam a teacher writes, the paper a student
 * receives, the answers that come back and the record kept of a sitting.
 * Everything here is plain JSON so that it can travel in a file or over the
 * classroom network unchanged.
 */

/** A saved laboratory configuration (see `exportSnapshot` in the lab state). */
export type LabSnapshot = Record<string, unknown>

export type QuestionType = 'written' | 'mcq' | 'bench'

interface QuestionBase {
  id: string
  prompt: string
  points: number
}

export interface McqOption {
  id: string
  text: string
}

/** One quantity the student reports after working on the bench. */
export interface BenchField {
  id: string
  label: string
  unit: string
}

export interface WrittenPaperQuestion extends QuestionBase {
  type: 'written'
}

export interface McqPaperQuestion extends QuestionBase {
  type: 'mcq'
  options: McqOption[]
}

export interface BenchPaperQuestion extends QuestionBase {
  type: 'bench'
  /** The apparatus as the student finds it. */
  setup: LabSnapshot
  fields: BenchField[]
  /** Hide lens focal lengths and the interferometer's laser line from the student. */
  concealUnknowns: boolean
  /** Whether the lab notebook, which evaluates the experiment's formula, may be used. */
  allowNotebook: boolean
}

export type PaperQuestion = WrittenPaperQuestion | McqPaperQuestion | BenchPaperQuestion

export interface WrittenQuestion extends WrittenPaperQuestion {
  /** Reference answer shown to the teacher while marking. */
  modelAnswer: string
}

export interface McqQuestion extends McqPaperQuestion {
  correctOptionId: string | null
}

export interface BenchKeyField extends BenchField {
  /** Accepted value in the unit of the field; null when the teacher marks it by hand. */
  expected: number | null
  /** Accepted deviation from the expected value, in the same unit. */
  tolerance: number
}

export interface BenchQuestion extends Omit<BenchPaperQuestion, 'fields'> {
  fields: BenchKeyField[]
}

export type Question = WrittenQuestion | McqQuestion | BenchQuestion

interface ExamBase {
  version: 1
  id: string
  title: string
  course: string
  instructions: string
  durationMinutes: number
}

/** The teacher's copy: questions together with the answer key (.opticsmaster). */
export interface ExamMaster extends ExamBase {
  format: 'optics-exam-master'
  questions: Question[]
  updatedAt: number
}

/** What a student receives: the same questions without the answer key (.opticsexam). */
export interface ExamPaper extends ExamBase {
  format: 'optics-exam'
  questions: PaperQuestion[]
}

export interface WrittenAnswer {
  type: 'written'
  text: string
}

export interface McqAnswer {
  type: 'mcq'
  choice: string | null
}

export interface BenchAnswer {
  type: 'bench'
  /** What the student typed for each field, keyed by field id. */
  values: Record<string, string>
  notes: string
  /** The bench as the student left it. */
  lab: LabSnapshot | null
}

export type Answer = WrittenAnswer | McqAnswer | BenchAnswer
export type Answers = Record<string, Answer>

export interface Mark {
  points: number
  comment: string
  /** The answer as it was when marked, to notice a later resubmission. */
  answerDigest: string
}

export type StudentStatus = 'working' | 'submitted'

export interface StudentEvent {
  at: number
  type: 'joined' | 'rejoined' | 'submitted' | 'unsubmitted' | 'collected' | 'imported'
}

export interface StudentRecord {
  id: string
  name: string
  className: string
  joinedAt: number
  status: StudentStatus
  submittedAt: number | null
  /** True when the answers were taken in at the end of the time, not handed in. */
  autoCollected: boolean
  answers: Answers
  marks: Record<string, Mark>
  events: StudentEvent[]
  source: 'classroom' | 'file'
}

export type SessionState = 'lobby' | 'running' | 'ended'

/** One sitting of an exam, as stored on the teacher's machine. */
export interface SessionRecord {
  format: 'optics-session'
  version: 1
  id: string
  roomName: string
  exam: ExamMaster
  paper: ExamPaper
  createdAt: number
  startedAt: number | null
  deadline: number | null
  endedAt: number | null
  state: SessionState
  students: StudentRecord[]
}

export interface SessionSummary {
  id: string
  roomName: string
  examTitle: string
  createdAt: number
  state: SessionState
  students: { name: string; className: string }[]
}

/** A student's answers as a file (.opticsanswers), for exams taken without the classroom network. */
export interface AnswersFile {
  format: 'optics-answers'
  version: 1
  examId: string
  examTitle: string
  name: string
  className: string
  startedAt: number
  submittedAt: number
  autoCollected: boolean
  answers: Answers
}
