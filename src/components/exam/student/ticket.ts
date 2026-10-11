/**
 * What a student's laptop remembers between restarts: which classroom sitting
 * it belongs to, and the answers not yet confirmed by the teacher's machine.
 */
import { parseAnswers } from '../../../exam/format'
import type { ClassroomTicket } from '../../../exam/sitting'
import type { Answers } from '../../../exam/types'

const TICKET_KEY = 'virtual-optics-lab/exam-ticket'
const DEVICE_KEY = 'virtual-optics-lab/device'
const DRAFT_KEY = 'virtual-optics-lab/exam-draft'

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable; the exam still runs, without surviving a restart.
  }
}

export function loadTicket(): ClassroomTicket | null {
  const ticket = read(TICKET_KEY) as Partial<ClassroomTicket> | null
  return ticket && typeof ticket.base === 'string' && typeof ticket.token === 'string' ? { base: ticket.base, token: ticket.token } : null
}

export const saveTicket = (ticket: ClassroomTicket) => write(TICKET_KEY, ticket)

export function forgetTicket() {
  write(TICKET_KEY, null)
  write(DRAFT_KEY, null)
}

/** Identifies this laptop to the classroom, so that it gets its own sitting back after a restart. */
export function deviceId(): string {
  const stored = read(DEVICE_KEY)
  if (typeof stored === 'string' && stored) return stored
  const created = crypto.randomUUID()
  write(DEVICE_KEY, created)
  return created
}

/** Answers typed in the sitting identified by `owner` that may not have reached the teacher yet. */
export function loadDraft(owner: string): Answers | null {
  const draft = read(DRAFT_KEY) as { owner?: unknown; answers?: unknown } | null
  return draft && draft.owner === owner ? parseAnswers(draft.answers) : null
}

export const saveDraft = (owner: string, answers: Answers) => write(DRAFT_KEY, { owner, answers })
