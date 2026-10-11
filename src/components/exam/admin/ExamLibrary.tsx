import { useState } from 'react'
import { examPaperHtml } from '../../../exam/documents'
import { FILE_EXTENSIONS, examProblems, fileSafe, newExam, newId, toPaper } from '../../../exam/format'
import { maxPoints } from '../../../exam/grading'
import type { ExamMaster } from '../../../exam/types'
import { desktop, errorMessage } from '../../../platform/desktop'
import { formatDateTime, plural } from '../shared'

interface Props {
  exams: ExamMaster[]
  reload(): Promise<void>
  onEdit(exam: ExamMaster): void
  onImport(): void
  /** A sitting was created; `open` asks for its classroom to be opened on the network. */
  onSession(sessionId: string, open: boolean): void
}

const today = (): string => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })

/** The teacher's exams, and what can be done with each. */
export function ExamLibrary({ exams, reload, onEdit, onImport, onSession }: Props) {
  /** The exam for which a classroom is being named. */
  const [starting, setStarting] = useState<{ exam: ExamMaster; roomName: string } | null>(null)
  const [message, setMessage] = useState('')

  const attempt = async (action: () => Promise<unknown>) => {
    setMessage('')
    try {
      await action()
    } catch (failure) {
      setMessage(errorMessage(failure))
    }
  }

  const create = () =>
    attempt(async () => {
      const exam = newExam()
      await desktop().saveExam(exam)
      onEdit(exam)
    })

  const duplicate = (exam: ExamMaster) =>
    attempt(async () => {
      await desktop().saveExam({ ...exam, id: newId('exam'), title: `${exam.title} (copy)`, updatedAt: Date.now() })
      await reload()
    })

  const remove = (exam: ExamMaster) =>
    attempt(async () => {
      if (!window.confirm(`Delete the exam “${exam.title}”? Sittings already held keep their own copy of it.`)) return
      await desktop().removeExam(exam.id)
      await reload()
    })

  const createSession = (exam: ExamMaster, roomName: string, open: boolean) =>
    attempt(async () => {
      const session = await desktop().createSession({ exam, paper: toPaper(exam), roomName: roomName.trim() || exam.title, state: open ? 'lobby' : 'ended' })
      setStarting(null)
      onSession(session.id, open)
    })

  const exportFile = (exam: ExamMaster, kind: 'master' | 'paper') =>
    desktop().saveFile({
      defaultName: `${fileSafe(exam.title)}.${FILE_EXTENSIONS[kind]}`,
      text: JSON.stringify(kind === 'master' ? exam : toPaper(exam)),
      extensions: [FILE_EXTENSIONS[kind]],
      label: kind === 'master' ? 'Exam with answer key (teacher)' : 'Exam file (student)',
    })

  const exportPdf = (exam: ExamMaster, key: boolean) =>
    desktop().savePdf({ defaultName: `${fileSafe(exam.title)}${key ? ' - answer key' : ''}.pdf`, html: examPaperHtml(exam, { key }) })

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <button className="chip primary" onClick={create}>
            + New exam
          </button>
          <button className="chip" onClick={onImport} title={`Open a .${FILE_EXTENSIONS.master} file written on another computer`}>
            Import exam file…
          </button>
        </div>

        {message && (
          <p className="notice error" role="alert">
            {message}
          </p>
        )}

        {exams.length === 0 && (
          <section className="panel exam-card centered">
            <h2 className="exam-title">No exams yet</h2>
            <p>Write the first one with “New exam”. It can mix written questions, multiple choice and questions the students solve on the virtual bench.</p>
          </section>
        )}

        {exams.map((exam) => {
          const problems = examProblems(exam)
          const ready = problems.length === 0
          return (
            <section key={exam.id} className="panel exam-card">
              <div className="library-row">
                <div className="library-title">
                  <h2 className="exam-title">{exam.title}</h2>
                  <p className="panel-sub">
                    {[exam.course, plural(exam.questions.length, 'question'), plural(maxPoints(exam), 'point'), `${exam.durationMinutes} min`, `edited ${formatDateTime(exam.updatedAt)}`].filter(Boolean).join(' · ')}
                  </p>
                  {!ready && <p className="concealed">Not ready: {problems[0]}</p>}
                </div>
                <div className="exam-actions">
                  <button className="chip" onClick={() => onEdit(exam)}>
                    Edit
                  </button>
                  <button className="chip primary" disabled={!ready} onClick={() => setStarting({ exam, roomName: `${exam.title} — ${today()}` })}>
                    Open a classroom
                  </button>
                </div>
              </div>
              <div className="library-more">
                <span className="panel-sub">Save as</span>
                <button className="chip" disabled={!ready} onClick={() => exportFile(exam, 'paper')} title="For students: the questions without the answer key">
                  Student file (.{FILE_EXTENSIONS.paper})
                </button>
                <button className="chip" onClick={() => exportFile(exam, 'master')} title="For you: the exam with its answer key, to keep or move to another computer">
                  Teacher file (.{FILE_EXTENSIONS.master})
                </button>
                <button className="chip" onClick={() => exportPdf(exam, false)}>
                  Question paper (PDF)
                </button>
                <button className="chip" onClick={() => exportPdf(exam, true)}>
                  Answer key (PDF)
                </button>
                <span className="exam-bar-space" />
                <button className="chip" disabled={!ready} onClick={() => createSession(exam, `${exam.title} — answer files`, false)} title="For students who sat the exam from a file: a sitting to import their answers files into">
                  Collect answer files
                </button>
                <button className="chip" onClick={() => duplicate(exam)}>
                  Duplicate
                </button>
                <button className="chip danger" onClick={() => remove(exam)}>
                  Delete
                </button>
              </div>
            </section>
          )
        })}
      </div>

      {starting && (
        <div className="exam-overlay" role="dialog" aria-modal="true" aria-label="Open a classroom">
          <form
            className="panel exam-card"
            onSubmit={(event) => {
              event.preventDefault()
              void createSession(starting.exam, starting.roomName, true)
            }}
          >
            <header className="panel-header">
              <h2>Open a classroom</h2>
            </header>
            <div className="exam-form">
              <p>
                {starting.exam.title} · {starting.exam.durationMinutes} minutes
              </p>
              <label>
                <span>Name of this sitting (the students see it)</span>
                <input className="exam-input" autoFocus value={starting.roomName} maxLength={80} onChange={(event) => setStarting({ ...starting, roomName: event.target.value })} />
              </label>
              <p className="hint">The students join first; the clock starts for everyone when you start the exam.</p>
              <div className="exam-actions">
                <button type="button" className="chip" onClick={() => setStarting(null)}>
                  Cancel
                </button>
                <button type="submit" className="chip primary">
                  Open the classroom
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
