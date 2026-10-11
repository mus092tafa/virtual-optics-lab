import { useEffect, useMemo, useState } from 'react'
import { studentTotal } from '../../../exam/grading'
import type { SessionRecord, SessionSummary } from '../../../exam/types'
import { desktop, errorMessage, normalizeSession } from '../../../platform/desktop'
import { formatDateTime, plural } from '../shared'

const STATE_NAMES: Record<SessionSummary['state'], string> = { lobby: 'not started', running: 'in progress', ended: 'ended' }

interface SittingsProps {
  activeSessionId: string | null
  onOpen(sessionId: string): void
}

/** Every sitting held on this machine, newest first. */
export function Sittings({ activeSessionId, onOpen }: SittingsProps) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [message, setMessage] = useState('')

  const reload = () => desktop().listSessions().then(setSessions)
  useEffect(() => {
    let cancelled = false
    void desktop()
      .listSessions()
      .then((list) => {
        if (!cancelled) setSessions(list)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = async (session: SessionSummary) => {
    if (!window.confirm(`Delete the sitting “${session.roomName}” with the answers and marks of ${plural(session.students.length, 'student')}? This cannot be undone.`)) return
    try {
      await desktop().removeSession(session.id)
      await reload()
    } catch (failure) {
      setMessage(errorMessage(failure))
    }
  }

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <span className="panel-sub">Each time an exam is given, the students’ answers and your marks are kept here.</span>
          <span className="exam-bar-space" />
          <button className="chip" onClick={() => desktop().openRecordsFolder()} title="The folder on this computer where exams and sittings are stored, for backup">
            Open the records folder
          </button>
        </div>
        {message && <p className="notice error">{message}</p>}
        <section className="panel exam-card">
          {sessions?.length === 0 && <p className="empty padded">No exam has been given yet. Open a classroom from the Exams tab.</p>}
          {sessions && sessions.length > 0 && (
            <div className="table-wrap">
              <table className="class-list">
                <thead>
                  <tr>
                    <th>Sitting</th>
                    <th>Exam</th>
                    <th>Date</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.roomName}</td>
                      <td>{session.examTitle}</td>
                      <td>{formatDateTime(session.createdAt)}</td>
                      <td>{session.students.length}</td>
                      <td>
                        {STATE_NAMES[session.state]}
                        {session.id === activeSessionId && <span className="verdict-right"> · classroom open</span>}
                      </td>
                      <td className="row-actions">
                        <button className="chip primary" onClick={() => onOpen(session.id)}>
                          Open
                        </button>
                        <button className="chip danger" onClick={() => remove(session)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

interface StudentsProps {
  onOpen(sessionId: string, studentId: string): void
}

interface Entry {
  key: string
  name: string
  className: string
  sittings: { session: SessionRecord; studentId: string; score: number; max: number; pending: number; submitted: boolean }[]
}

/** The history of each student across all sittings. Students are matched by name and class. */
export function StudentHistory({ onOpen }: StudentsProps) {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const summaries = await desktop().listSessions()
      const loaded = await Promise.all(summaries.map((summary) => desktop().loadSession(summary.id)))
      if (!cancelled) setSessions(loaded.filter((session): session is SessionRecord => session !== null).map(normalizeSession))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const entries = useMemo(() => {
    const byStudent = new Map<string, Entry>()
    for (const session of sessions ?? []) {
      for (const student of session.students) {
        const key = `${student.name.trim().toLowerCase()}\u0000${student.className.trim().toLowerCase()}`
        const entry = byStudent.get(key) ?? { key, name: student.name, className: student.className, sittings: [] }
        const total = studentTotal(session.exam, student)
        entry.sittings.push({ session, studentId: student.id, score: total.score, max: total.max, pending: total.pending, submitted: student.status === 'submitted' })
        byStudent.set(key, entry)
      }
    }
    return [...byStudent.values()].sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name))
  }, [sessions])

  const needle = filter.trim().toLowerCase()
  const shown = needle ? entries.filter((entry) => `${entry.name} ${entry.className}`.toLowerCase().includes(needle)) : entries

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <input className="exam-input search" placeholder="Search by name or class" aria-label="Search students" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <span className="panel-sub">{sessions ? plural(shown.length, 'student') : 'loading…'}</span>
        </div>
        {sessions && entries.length === 0 && (
          <section className="panel exam-card">
            <p className="empty padded">No student has sat an exam yet.</p>
          </section>
        )}
        {shown.map((entry) => (
          <section key={entry.key} className="panel exam-card">
            <header className="panel-header">
              <h2 className="plain">{entry.name}</h2>
              <span className="panel-sub">
                {entry.className} · {plural(entry.sittings.length, 'exam')}
              </span>
            </header>
            <div className="table-wrap">
              <table className="class-list">
                <tbody>
                  {entry.sittings.map((sitting) => (
                    <tr key={`${sitting.session.id}:${sitting.studentId}`}>
                      <td>{sitting.session.exam.title}</td>
                      <td>{sitting.session.roomName}</td>
                      <td>{formatDateTime(sitting.session.startedAt ?? sitting.session.createdAt)}</td>
                      <td>
                        {sitting.submitted ? `${sitting.score} / ${sitting.max}` : 'not submitted'}
                        {sitting.submitted && sitting.pending > 0 && <span className="concealed"> · {sitting.pending} to mark</span>}
                      </td>
                      <td className="row-actions">
                        <button className="chip" onClick={() => onOpen(sitting.session.id, sitting.studentId)}>
                          Open answers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
