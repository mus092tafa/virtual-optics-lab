import { useState } from 'react'
import { resultsCsv } from '../../../exam/csv'
import { answerSheetHtml, resultsHtml } from '../../../exam/documents'
import { FILE_EXTENSIONS, fileSafe, isAnswered, parseAnswersFile, parseJson } from '../../../exam/format'
import { studentTotal } from '../../../exam/grading'
import { loadSettings } from '../../../exam/settings'
import type { SessionRecord, StudentRecord } from '../../../exam/types'
import { desktop, errorMessage } from '../../../platform/desktop'
import type { ClassroomStatus } from '../../../platform/desktop'
import { formatClock, formatDateTime, formatTime, plural, useNow } from '../shared'
import { Correction } from './Correction'
import { useSession } from './useSession'

interface Props {
  sessionId: string
  /** The classroom open on the network, when it is this sitting. */
  classroom: ClassroomStatus | null
  onClassroom(status: ClassroomStatus | null): void
  onBack(): void
  /** Open straight on one student's answers. */
  initialStudentId?: string
}

const DEFAULT_PORT = 47800

function statusText(session: SessionRecord, student: StudentRecord): string {
  if (student.status === 'submitted') return student.autoCollected ? 'collected at time limit' : `submitted ${formatTime(student.submittedAt)}`
  return session.state === 'lobby' ? 'waiting' : session.state === 'running' ? 'working' : 'not submitted'
}

/** A sitting: the classroom controls while it runs, the class list, and the way into marking. */
export function SessionView({ sessionId, classroom, onClassroom, onBack, initialStudentId }: Props) {
  const { session, missing } = useSession(sessionId)
  const [studentId, setStudentId] = useState<string | null>(initialStudentId ?? null)
  const [message, setMessage] = useState('')
  const now = useNow()

  if (missing) {
    return (
      <main className="exam-scroll">
        <div className="exam-column">
          <p className="notice error">This sitting is no longer in the records.</p>
          <button className="chip" onClick={onBack}>
            ← Back
          </button>
        </div>
      </main>
    )
  }
  if (!session) return <main className="exam-scroll" />

  const student = session.students.find((entry) => entry.id === studentId)
  if (student) return <Correction session={session} student={student} onBack={() => setStudentId(null)} onSelect={setStudentId} />

  const exam = session.exam
  const open = classroom?.session.id === session.id
  const remaining = session.deadline === null ? null : session.deadline - now
  const overtime = session.state === 'running' && remaining !== null && remaining <= 0
  const collecting = open && overtime
  const students = [...session.students].sort((a, b) => a.name.localeCompare(b.name))
  const submitted = students.filter((entry) => entry.status === 'submitted')
  const toMark = submitted.filter((entry) => studentTotal(exam, entry).pending > 0)

  const attempt = async (action: () => Promise<unknown>) => {
    setMessage('')
    try {
      await action()
    } catch (failure) {
      setMessage(errorMessage(failure))
    }
  }

  const command = (name: 'begin' | 'end' | 'extend', minutes?: number) => attempt(async () => onClassroom(await desktop().classroomCommand({ command: name, minutes })))

  const importAnswers = () =>
    attempt(async () => {
      const file = await desktop().openFile({ title: 'Import a student’s answers file', extensions: [FILE_EXTENSIONS.answers], label: 'Exam answers' })
      if (!file) return
      const answers = parseAnswersFile(parseJson(file.text))
      if (!answers) throw new Error(`${file.name} is not a valid answers file.`)
      if (answers.examId !== exam.id) throw new Error(`${file.name} belongs to another exam (“${answers.examTitle}”).`)
      await desktop().importAnswers({ sessionId: session.id, file: answers })
    })

  const exportSheets = () =>
    attempt(async () => {
      const result = await desktop().savePdfs({
        items: submitted.map((entry) => ({ name: `${fileSafe(`${entry.name} - ${entry.className}`)}.pdf`, html: answerSheetHtml(exam, entry, { graded: true, roomName: session.roomName }) })),
      })
      if (result) setMessage(`${plural(result.count, 'answer sheet')} saved in ${result.directory}`)
    })

  const baseName = fileSafe(`${exam.title} - ${session.roomName}`)

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <button className="chip" onClick={onBack}>
            ← Sittings
          </button>
          <span className="exam-bar-space" />
          <button className="chip" disabled={session.students.length === 0} onClick={() => desktop().saveFile({ defaultName: `${baseName} - results.csv`, text: resultsCsv(session), extensions: ['csv'], label: 'CSV file' })}>
            Results (CSV)
          </button>
          <button className="chip" disabled={session.students.length === 0} onClick={() => desktop().savePdf({ defaultName: `${baseName} - results.pdf`, html: resultsHtml(session) })}>
            Results (PDF)
          </button>
          <button className="chip" disabled={submitted.length === 0} onClick={exportSheets}>
            All answer sheets (PDF)
          </button>
          <button className="chip" onClick={importAnswers} title="Add a student who sat the exam from a file, without the network">
            Import answers file…
          </button>
        </div>

        {message && (
          <p className="notice info" role="status">
            {message}
          </p>
        )}

        <section className="panel exam-card">
          <div className="classroom-head">
            <div>
              <h2 className="exam-title">{session.roomName}</h2>
              <p className="panel-sub">
                {exam.title} · {exam.durationMinutes} min · {plural(exam.questions.length, 'question')} · created {formatDateTime(session.createdAt)}
              </p>
            </div>
            <span className={`exam-pill state-${session.state}`}>{collecting ? 'collecting answers' : overtime ? 'time over' : session.state === 'lobby' ? 'not started' : session.state === 'running' ? 'in progress' : 'ended'}</span>
          </div>

          {open && session.state !== 'ended' && (
            <div className="classroom-box">
              <div>
                <span className="field-label">Students join from “Join an exam” on their laptops</span>
                <p>
                  {classroom.discoverable
                    ? `The students’ laptops find this classroom by themselves${classroom.session.teacherName ? `, under the name “${classroom.session.teacherName}”` : ''}. If one does not, press “Find teachers on this network” under Settings on that laptop, or enter this address there:`
                    : 'The automatic search is unavailable on this computer. Press “Find teachers on this network” under Settings on each student laptop, or enter this address there:'}
                </p>
                <p className="address-list mono">
                  {classroom.addresses.length > 0
                    ? classroom.addresses.map((address) => (classroom.port === DEFAULT_PORT ? address : `${address}:${classroom.port}`)).join('   ·   ')
                    : 'This computer is not connected to a network.'}
                </p>
              </div>
              {session.state === 'lobby' ? (
                <button className="chip primary large" disabled={session.students.length === 0} onClick={() => command('begin')}>
                  Start the exam for {plural(session.students.length, 'student')}
                </button>
              ) : (
                <div className="classroom-clock">
                  <span className={`exam-clock${remaining !== null && remaining <= 5 * 60_000 ? ' low' : ''}`} role="timer" aria-label="Time remaining">
                    {formatClock(remaining ?? 0)}
                  </span>
                  <div className="exam-actions">
                    <button className="chip" disabled={collecting} onClick={() => command('extend', 5)}>
                      + 5 min
                    </button>
                    <button
                      className="chip danger"
                      disabled={collecting}
                      onClick={() => {
                        if (window.confirm('End the exam now for everyone? The answers written so far are collected.')) void command('end')
                      }}
                    >
                      End the exam now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!open && session.state !== 'ended' && !overtime && (
            <div className="classroom-box">
              <p>This classroom is not open on the network. {session.state === 'running' ? 'The exam clock is still running.' : ''}</p>
              <button className="chip primary" onClick={() => attempt(async () => onClassroom(await desktop().openClassroom({ sessionId: session.id, teacherName: loadSettings(localStorage).teacherName })))}>
                {session.state === 'running' ? 'Resume the classroom' : 'Open the classroom'}
              </button>
            </div>
          )}

          {!open && overtime && (
            <div className="classroom-box">
              <p>The exam time ran out while this classroom was closed. Laptops that are still on can hand in the last answers they kept; otherwise the sitting ends with the answers received so far.</p>
              <div className="exam-actions">
                <button className="chip primary" onClick={() => attempt(async () => onClassroom(await desktop().openClassroom({ sessionId: session.id, teacherName: loadSettings(localStorage).teacherName })))}>
                  Collect from the laptops
                </button>
                <button className="chip" onClick={() => attempt(() => desktop().finishSession(session.id))}>
                  End the sitting as it is
                </button>
              </div>
            </div>
          )}

          {open && session.state === 'ended' && (
            <div className="classroom-box">
              <p>The exam has ended and every student’s answers are in. The classroom can be closed.</p>
              <button className="chip" onClick={() => attempt(async () => (await desktop().closeClassroom(), onClassroom(null)))}>
                Close the classroom
              </button>
            </div>
          )}
        </section>

        {toMark.length > 0 && (
          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Submitted — ready to mark</h2>
              <span className="panel-sub">{plural(toMark.length, 'student')}</span>
            </header>
            <div className="mark-queue">
              {toMark.map((entry) => (
                <button key={entry.id} className="chip primary" onClick={() => setStudentId(entry.id)}>
                  {entry.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="panel exam-card">
          <header className="panel-header">
            <h2>Students</h2>
            <span className="panel-sub">
              {session.students.length} joined · {submitted.length} submitted
            </span>
          </header>
          {students.length === 0 ? (
            <p className="empty padded">Nobody has joined yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="class-list">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Answered</th>
                    <th>Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {students.map((entry) => {
                    const total = studentTotal(exam, entry)
                    const answered = exam.questions.filter((question) => isAnswered(question, entry.answers[question.id])).length
                    const done = entry.status === 'submitted'
                    return (
                      <tr key={entry.id} className={done ? 'submitted' : ''}>
                        <td>{entry.name}</td>
                        <td>{entry.className}</td>
                        <td>{statusText(session, entry)}</td>
                        <td>
                          {answered} / {exam.questions.length}
                        </td>
                        <td>
                          {done ? `${total.score} / ${total.max}` : '—'}
                          {done && total.pending > 0 && <span className="concealed"> · {total.pending} to mark</span>}
                        </td>
                        <td className="row-actions">
                          <button className={`chip${done && total.pending > 0 ? ' primary' : ''}`} onClick={() => setStudentId(entry.id)}>
                            {done ? (total.pending > 0 ? 'Mark' : 'Review') : 'View'}
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${entry.name}`}
                            title="Remove this student and their answers from the sitting"
                            onClick={() => {
                              if (window.confirm(`Remove ${entry.name} and their answers from this sitting? This cannot be undone.`)) void attempt(() => desktop().removeStudent({ sessionId: session.id, studentId: entry.id }))
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
