import { useCallback, useEffect, useRef, useState } from 'react'
import { FILE_EXTENSIONS, parseAnswersFile, parseJson, parseMaster, toPaper } from '../../../exam/format'
import type { ExamMaster } from '../../../exam/types'
import { desktop, errorMessage } from '../../../platform/desktop'
import type { OpenedFile } from '../../../platform/desktop'
import { BrandMark } from '../BrandMark'
import { ExamEditor } from './ExamEditor'
import { ExamLibrary } from './ExamLibrary'
import { Sittings, StudentHistory } from './Records'
import { SessionView } from './SessionView'
import { useClassroom } from './useSession'

interface Props {
  onHome(): void
  /** A teacher's file the application was opened with. */
  incomingFile: OpenedFile | null
}

type View =
  | { name: 'library' }
  | { name: 'editor'; exam: ExamMaster }
  | { name: 'sittings' }
  | { name: 'session'; sessionId: string; studentId?: string }
  | { name: 'students' }

const TABS: { view: 'library' | 'sittings' | 'students'; label: string }[] = [
  { view: 'library', label: 'Exams' },
  { view: 'sittings', label: 'Sittings & marking' },
  { view: 'students', label: 'Students' },
]

/** The teacher's part of the application: writing exams, running a classroom, marking, records. */
export default function AdminArea({ onHome, incomingFile }: Props) {
  const [view, setView] = useState<View>({ name: 'library' })
  const [exams, setExams] = useState<ExamMaster[]>([])
  const [message, setMessage] = useState('')
  const { classroom, set: setClassroom } = useClassroom()

  const reload = useCallback(
    () =>
      desktop()
        .listExams()
        .then((stored) => setExams(stored.map(parseMaster).filter((exam): exam is ExamMaster => exam !== null))),
    [],
  )

  useEffect(() => {
    let cancelled = false
    void desktop()
      .listExams()
      .then((stored) => {
        if (!cancelled) setExams(stored.map(parseMaster).filter((exam): exam is ExamMaster => exam !== null))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const receive = useCallback(
    async (file: OpenedFile) => {
      setMessage('')
      try {
        const data = parseJson(file.text)
        const master = parseMaster(data)
        if (master) {
          const stored = (await desktop().listExams()).map(parseMaster)
          if (stored.some((exam) => exam?.id === master.id) && !window.confirm(`“${master.title}” is already among your exams. Replace it with the one in ${file.name}?`)) return
          await desktop().saveExam(master)
          await reload()
          return setView({ name: 'editor', exam: master })
        }
        const answers = parseAnswersFile(data)
        if (answers) {
          // The answers go into the latest sitting of their exam, or into a new one made for answer files.
          const sittings = await desktop().listSessions()
          const candidates = await Promise.all(sittings.map((summary) => desktop().loadSession(summary.id)))
          let session = candidates.find((candidate) => candidate?.exam.id === answers.examId) ?? null
          if (!session) {
            const exam = (await desktop().listExams()).map(parseMaster).find((candidate) => candidate?.id === answers.examId)
            if (!exam) throw new Error(`The exam “${answers.examTitle}” these answers belong to is not among your exams.`)
            session = await desktop().createSession({ exam, paper: toPaper(exam), roomName: `${exam.title} — answer files`, state: 'ended' })
          }
          await desktop().importAnswers({ sessionId: session.id, file: answers })
          return setView({ name: 'session', sessionId: session.id })
        }
        throw new Error(`${file.name} is not an exam file this edition can open.`)
      } catch (failure) {
        setMessage(errorMessage(failure))
      }
    },
    [reload],
  )

  // Each file handed over by the shell is taken in once.
  const taken = useRef<OpenedFile | null>(null)
  useEffect(() => {
    if (!incomingFile || taken.current === incomingFile) return
    taken.current = incomingFile
    void Promise.resolve(incomingFile).then(receive)
  }, [incomingFile, receive])

  const importExam = async () => {
    const file = await desktop().openFile({ title: 'Import an exam', extensions: [FILE_EXTENSIONS.master], label: 'Exam with answer key (teacher)' })
    if (file) await receive(file)
  }

  const openSession = async (sessionId: string, open: boolean) => {
    setMessage('')
    try {
      if (open) setClassroom(await desktop().openClassroom(sessionId))
    } catch (failure) {
      setMessage(`The classroom could not be opened on the network: ${errorMessage(failure)}`)
    }
    setView({ name: 'session', sessionId })
  }

  const tab = view.name === 'editor' ? 'library' : view.name === 'session' ? 'sittings' : view.name

  return (
    <div className="app exam-page">
      <header className="exam-bar">
        <button className="chip" onClick={onHome}>
          ← Start
        </button>
        <BrandMark />
        <h1>Exams</h1>
        <nav className="segmented" aria-label="Teacher’s area">
          {TABS.map((entry) => (
            <button
              key={entry.view}
              className={tab === entry.view ? 'active' : ''}
              onClick={() => {
                if (entry.view === 'library') void reload()
                setView({ name: entry.view } as View)
              }}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <span className="exam-bar-space" />
        {classroom && classroom.session.state !== 'ended' && (
          <button className="exam-pill live" onClick={() => setView({ name: 'session', sessionId: classroom.session.id })} title="Go to the open classroom">
            ● Classroom open: {classroom.session.roomName}
          </button>
        )}
      </header>

      {message && (
        <p className="notice error" role="alert">
          {message}
        </p>
      )}

      {view.name === 'library' && <ExamLibrary exams={exams} reload={reload} onEdit={(exam) => setView({ name: 'editor', exam })} onImport={importExam} onSession={openSession} />}
      {view.name === 'editor' && (
        <ExamEditor
          key={view.exam.id}
          exam={view.exam}
          onClose={() => {
            // The editor saves on the way out; read the list once that write is done.
            window.setTimeout(() => void reload(), 100)
            setView({ name: 'library' })
          }}
        />
      )}
      {view.name === 'sittings' && <Sittings activeSessionId={classroom?.session.id ?? null} onOpen={(sessionId) => setView({ name: 'session', sessionId })} />}
      {view.name === 'session' && (
        <SessionView
          key={`${view.sessionId}:${view.studentId ?? ''}`}
          sessionId={view.sessionId}
          classroom={classroom}
          onClassroom={setClassroom}
          onBack={() => setView({ name: 'sittings' })}
          initialStudentId={view.studentId}
        />
      )}
      {view.name === 'students' && <StudentHistory onOpen={(sessionId, studentId) => setView({ name: 'session', sessionId, studentId })} />}
    </div>
  )
}
