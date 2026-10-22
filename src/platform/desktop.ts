/**
 * The desktop shell as the page sees it (see electron/preload.cjs). In a plain
 * browser there is no shell: the laboratory works, the exam mode does not.
 */
import { parseAnswers } from '../exam/format'
import type { AnswersFile, ExamMaster, ExamPaper, Mark, SessionRecord, SessionState, SessionSummary } from '../exam/types'

export type Edition = 'student' | 'admin'

/** The edition this bundle was built as. The student build contains no exam-writing or marking code. */
export const EDITION: Edition = import.meta.env.VITE_EDITION === 'student' ? 'student' : 'admin'

export interface OpenedFile {
  name: string
  text: string
}

export interface FileChoice {
  extensions: string[]
  label: string
}

export interface DiscoveredRoom {
  address: string
  port: number
  /** The teacher who opened the classroom; empty from a teacher's edition that does not send it. */
  teacherName: string
  roomName: string
  examTitle: string
  state: string
}

export interface ClassroomStatus {
  session: SessionRecord
  port: number
  /** False when the students' search cannot find this classroom and the address must be typed. */
  discoverable: boolean
  addresses: string[]
  hostName: string
}

/** A newer release than the running one; `url` downloads this edition's installer. */
export interface AvailableUpdate {
  version: string
  url: string
  page: string
}

interface DesktopApi {
  info(): Promise<{ edition: Edition; version: string; hostName: string }>
  /** Null when up to date, offline, or GitHub could not be asked. */
  checkForUpdate(): Promise<AvailableUpdate | null>
  openFile(options: FileChoice & { title: string }): Promise<OpenedFile | null>
  saveFile(options: FileChoice & { defaultName: string; text: string }): Promise<string | null>
  savePdf(options: { defaultName: string; html: string }): Promise<string | null>
  savePdfs(options: { items: { name: string; html: string }[] }): Promise<{ directory: string; count: number } | null>
  takeOpenedFile(): Promise<OpenedFile | null>
  onFileOpened(listener: (file: OpenedFile) => void): () => void
  /** `thorough` also asks every neighbouring address, for a network the quick search does not get through. */
  discoverClassrooms(options?: { thorough: boolean }): Promise<DiscoveredRoom[]>

  listExams(): Promise<unknown[]>
  saveExam(exam: ExamMaster): Promise<void>
  removeExam(id: string): Promise<void>
  listSessions(): Promise<SessionSummary[]>
  loadSession(id: string): Promise<SessionRecord | null>
  createSession(options: { exam: ExamMaster; paper: ExamPaper; roomName: string; state: SessionState }): Promise<SessionRecord>
  removeSession(id: string): Promise<void>
  setMark(options: { sessionId: string; studentId: string; questionId: string; mark: Mark | null }): Promise<SessionRecord>
  importAnswers(options: { sessionId: string; file: AnswersFile }): Promise<SessionRecord>
  removeStudent(options: { sessionId: string; studentId: string }): Promise<SessionRecord>
  finishSession(sessionId: string): Promise<SessionRecord>
  openClassroom(options: { sessionId: string; teacherName: string }): Promise<ClassroomStatus>
  classroomStatus(): Promise<ClassroomStatus | null>
  closeClassroom(): Promise<void>
  classroomCommand(options: { command: 'begin' | 'end' | 'extend'; minutes?: number }): Promise<ClassroomStatus | null>
  onSessionUpdate(listener: (session: SessionRecord) => void): () => void
  openRecordsFolder(): Promise<string>
}

declare global {
  interface Window {
    opticsDesktop?: DesktopApi
  }
}

export const hasDesktop = (): boolean => typeof window !== 'undefined' && window.opticsDesktop !== undefined

/** The shell; call only where `hasDesktop()` holds. */
export function desktop(): DesktopApi {
  if (!window.opticsDesktop) throw new Error('This needs the desktop application.')
  return window.opticsDesktop
}

/**
 * Answers come from the students' laptops; they are reduced to well-formed
 * ones before the teacher's views read them.
 */
export function normalizeSession(session: SessionRecord): SessionRecord {
  return {
    ...session,
    students: session.students.map((student) => ({ ...student, answers: parseAnswers(student.answers), marks: student.marks ?? {}, events: student.events ?? [] })),
  }
}

/** The message of a failed shell call without the wrapper Electron puts around it. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
