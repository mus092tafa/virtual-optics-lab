/**
 * A student's sitting of an exam, seen from the student's laptop. The exam
 * runs the same way whether it comes from the teacher's classroom over the
 * network or from an exam file opened on this machine; this module hides the
 * difference.
 */
import { parseAnswers, parsePaper } from './format'
import type { Answers, AnswersFile, ExamPaper, SessionState, StudentStatus } from './types'

/** Where the sitting stands. Times are on this laptop's clock. */
export interface SittingStatus {
  state: SessionState
  deadline: number | null
  status: StudentStatus
  submittedAt: number | null
  autoCollected: boolean
}

export interface SittingStart extends SittingStatus {
  /** Null while the teacher has not started the exam. */
  exam: ExamPaper | null
  answers: Answers
}

export interface Sitting {
  kind: 'classroom' | 'file'
  examTitle: string
  roomName: string
  student: { name: string; className: string }
  /** Names the copy of unsent answers kept on this laptop; null when the sitting is stored here anyway. */
  draftKey: string | null
  /** The questions and the answers saved so far. */
  load(): Promise<SittingStart>
  poll(): Promise<SittingStatus>
  save(answers: Answers): Promise<SittingStatus>
  submit(answers: Answers): Promise<SittingStatus>
  unsubmit(): Promise<SittingStatus>
  /** The answers as a file to hand to the teacher; only for a sitting of an exam file. */
  answersFile?(): AnswersFile
}

/** A request the classroom refused, with the reason it gave. */
export class SittingError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

// ---------- Classroom (network) ----------

interface ClassroomView {
  serverNow: number
  session: { roomName: string; examTitle: string; state: SessionState; deadline: number | null }
  student: { name: string; className: string; status: StudentStatus; submittedAt: number | null; autoCollected: boolean }
  exam?: unknown
  answers?: unknown
  token?: string
}

export interface RoomInfo {
  teacherName?: string
  roomName: string
  examTitle: string
  durationMinutes: number
  state: SessionState
}

const REQUEST_TIMEOUT_MS = 6000

async function request(base: string, method: string, path: string, token?: string, body?: unknown): Promise<ClassroomView> {
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new SittingError('offline', 'The teacher’s computer cannot be reached.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new SittingError(data?.error ?? 'failed', data?.message ?? 'The classroom refused the request.')
  return data as ClassroomView
}

/** "192.168.1.10" or "192.168.1.10:47800" as the base address of a classroom. */
export function classroomUrl(address: string, port = 47800): string {
  const trimmed = address.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return `http://${/:\d+$/.test(trimmed) ? trimmed : `${trimmed}:${port}`}`
}

export async function fetchRoom(base: string): Promise<RoomInfo> {
  const data = (await request(base, 'GET', '/api/room')) as unknown as RoomInfo & { app?: string }
  if (data.app !== 'virtual-optics-lab') throw new SittingError('failed', 'That address is not an exam classroom.')
  return data
}

/**
 * The teacher's clock decides when the exam ends. Deadlines are converted to
 * this laptop's clock using the difference seen in the latest reply, so a
 * laptop whose clock is wrong still counts down correctly.
 */
function statusOf(view: ClassroomView): SittingStatus {
  const offset = view.serverNow - Date.now()
  return {
    state: view.session.state,
    deadline: view.session.deadline === null ? null : view.session.deadline - offset,
    status: view.student.status,
    submittedAt: view.student.submittedAt === null ? null : view.student.submittedAt - offset,
    autoCollected: view.student.autoCollected,
  }
}

export interface ClassroomTicket {
  base: string
  token: string
}

function classroomSitting(ticket: ClassroomTicket, view: ClassroomView): Sitting {
  const call = (method: string, path: string, body?: unknown) => request(ticket.base, method, path, ticket.token, body)
  return {
    kind: 'classroom',
    examTitle: view.session.examTitle,
    roomName: view.session.roomName,
    student: { name: view.student.name, className: view.student.className },
    draftKey: ticket.token,
    async load() {
      const loaded = await call('GET', '/api/exam')
      return { ...statusOf(loaded), exam: loaded.exam === undefined ? null : parsePaper(loaded.exam), answers: parseAnswers(loaded.answers) }
    },
    poll: async () => statusOf(await call('GET', '/api/state')),
    save: async (answers) => statusOf(await call('PUT', '/api/answers', { answers })),
    submit: async (answers) => statusOf(await call('POST', '/api/submit', { answers })),
    unsubmit: async () => statusOf(await call('POST', '/api/unsubmit')),
  }
}

/** Registers this laptop in the classroom under the student's name. */
export async function joinClassroom(base: string, identity: { name: string; className: string; deviceId: string }): Promise<{ sitting: Sitting; ticket: ClassroomTicket }> {
  const view = await request(base, 'POST', '/api/join', undefined, identity)
  if (!view.token) throw new SittingError('failed', 'The classroom did not accept the registration.')
  const ticket = { base, token: view.token }
  return { sitting: classroomSitting(ticket, view), ticket }
}

/** Returns to a sitting this laptop had already joined; null when the classroom no longer knows it. */
export async function resumeClassroom(ticket: ClassroomTicket): Promise<Sitting | null> {
  try {
    return classroomSitting(ticket, await request(ticket.base, 'GET', '/api/state', ticket.token))
  } catch {
    return null
  }
}

// ---------- Exam file (no network) ----------

interface LocalRecord {
  name: string
  className: string
  startedAt: number
  deadline: number
  status: StudentStatus
  submittedAt: number | null
  autoCollected: boolean
  answers: Answers
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const localKey = (examId: string) => `virtual-optics-lab/sitting/${examId}`

function readLocal(examId: string, store: KeyValueStore): LocalRecord | null {
  try {
    return JSON.parse(store.getItem(localKey(examId)) ?? 'null') as LocalRecord | null
  } catch {
    return null
  }
}

/** The student whose sitting of this exam is still running on this laptop, if any. */
export function localSittingOwner(paper: ExamPaper, store: KeyValueStore, now: () => number = Date.now): { name: string; className: string } | null {
  const record = readLocal(paper.id, store)
  return record && now() <= record.deadline ? { name: record.name, className: record.className } : null
}

/**
 * A sitting of an exam file. The clock starts when the student begins and is
 * kept on this laptop, so reopening the application does not restart it. A
 * sitting that is still running is continued whoever asks; once it is over,
 * another student may begin their own.
 */
export function fileSitting(paper: ExamPaper, identity: { name: string; className: string }, store: KeyValueStore, now: () => number = Date.now): Sitting {
  const key = localKey(paper.id)
  const write = (record: LocalRecord): LocalRecord => {
    store.setItem(key, JSON.stringify(record))
    return record
  }
  const read = (): LocalRecord => {
    let record = readLocal(paper.id, store)
    const sameStudent = record?.name === identity.name && record?.className === identity.className
    if (!record || (now() > record.deadline && !sameStudent)) {
      const startedAt = now()
      record = write({ ...identity, startedAt, deadline: startedAt + paper.durationMinutes * 60_000, status: 'working', submittedAt: null, autoCollected: false, answers: {} })
    }
    // When the time runs out, whatever was written is what is handed in.
    if (record.status === 'working' && now() > record.deadline) record = write({ ...record, status: 'submitted', submittedAt: record.deadline, autoCollected: true })
    return record
  }
  const status = (record: LocalRecord): SittingStatus => ({
    state: now() > record.deadline ? 'ended' : 'running',
    deadline: record.deadline,
    status: record.status,
    submittedAt: record.submittedAt,
    autoCollected: record.autoCollected,
  })
  const requireOpen = (record: LocalRecord) => {
    if (now() > record.deadline) throw new SittingError('closed', 'The exam time is over.')
  }
  const first = read()
  return {
    kind: 'file',
    examTitle: paper.title,
    roomName: '',
    student: { name: first.name, className: first.className },
    draftKey: null,
    async load() {
      const record = read()
      return { ...status(record), exam: paper, answers: parseAnswers(record.answers) }
    },
    poll: async () => status(read()),
    async save(answers) {
      const record = read()
      requireOpen(record)
      if (record.status !== 'working') throw new SittingError('submitted', 'Your answers are submitted. Withdraw the submission to change them.')
      return status(write({ ...record, answers }))
    },
    async submit(answers) {
      const record = read()
      if (record.status === 'submitted') return status(record)
      requireOpen(record)
      return status(write({ ...record, answers, status: 'submitted', submittedAt: now(), autoCollected: false }))
    },
    async unsubmit() {
      const record = read()
      requireOpen(record)
      return status(write({ ...record, status: 'working', submittedAt: null }))
    },
    answersFile() {
      const record = read()
      return {
        format: 'optics-answers',
        version: 1,
        examId: paper.id,
        examTitle: paper.title,
        name: record.name,
        className: record.className,
        startedAt: record.startedAt,
        submittedAt: record.submittedAt ?? now(),
        autoCollected: record.autoCollected,
        answers: record.answers,
      }
    },
  }
}
