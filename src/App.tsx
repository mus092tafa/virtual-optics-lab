import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { LabWorkspace } from './components/exam/LabWorkspace'
import { SettingsPage } from './components/exam/SettingsPage'
import { StartScreen } from './components/exam/StartScreen'
import { ExamRunner } from './components/exam/student/ExamRunner'
import { JoinExam } from './components/exam/student/JoinExam'
import { forgetTicket, loadTicket } from './components/exam/student/ticket'
import { FILE_EXTENSIONS, parseJson, parsePaper } from './exam/format'
import { resumeClassroom } from './exam/sitting'
import type { Sitting } from './exam/sitting'
import type { ExamPaper } from './exam/types'
import { desktop, hasDesktop } from './platform/desktop'
import type { OpenedFile } from './platform/desktop'

// The teacher's part is a separate chunk that the student build does not contain.
const AdminArea = import.meta.env.VITE_EDITION === 'student' ? null : lazy(() => import('./components/exam/admin/AdminArea'))

type Screen =
  | { name: 'home' }
  | { name: 'lab' }
  | { name: 'join'; paper: ExamPaper | null }
  | { name: 'exam'; sitting: Sitting }
  | { name: 'admin' }
  /** `back` is the screen the settings were opened from. */
  | { name: 'settings'; back: 'home' | 'join' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [notice, setNotice] = useState('')
  /** A teacher's file the application was opened with, handed to the teacher's area. */
  const [adminFile, setAdminFile] = useState<OpenedFile | null>(null)
  const home = useCallback(() => {
    setAdminFile(null)
    setScreen({ name: 'home' })
  }, [])

  const receiveFile = useCallback((file: OpenedFile) => {
    if (file.name.toLowerCase().endsWith(`.${FILE_EXTENSIONS.paper}`)) {
      const paper = parsePaper(parseJson(file.text))
      if (!paper) return setNotice(`${file.name} is not a valid exam file.`)
      // An exam in progress is never replaced by opening another file.
      setScreen((current) => (current.name === 'exam' ? current : { name: 'join', paper }))
    } else if (AdminArea) {
      setAdminFile(file)
      setScreen((current) => (current.name === 'exam' ? current : { name: 'admin' }))
    } else {
      setNotice(`${file.name} can only be opened with the teacher’s edition.`)
    }
  }, [])

  useEffect(() => {
    if (!hasDesktop()) return
    let cancelled = false
    void (async () => {
      const file = await desktop().takeOpenedFile()
      if (cancelled) return
      if (file) return receiveFile(file)
      // A laptop restarted in the middle of a classroom exam goes straight back to it.
      const ticket = loadTicket()
      const sitting = ticket && (await resumeClassroom(ticket))
      if (!cancelled && sitting) setScreen((current) => (current.name === 'home' ? { name: 'exam', sitting } : current))
    })()
    const unsubscribe = desktop().onFileOpened(receiveFile)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [receiveFile])

  if (screen.name === 'lab') {
    return (
      <div className="app">
        <Header onHome={home} />
        <LabWorkspace />
      </div>
    )
  }
  if (screen.name === 'join') {
    return <JoinExam paper={screen.paper} onBack={home} onSettings={() => setScreen({ name: 'settings', back: 'join' })} onStart={(sitting) => setScreen({ name: 'exam', sitting })} />
  }
  if (screen.name === 'settings') {
    const back = screen.back
    return <SettingsPage onBack={() => (back === 'join' ? setScreen({ name: 'join', paper: null }) : home())} />
  }
  if (screen.name === 'exam') {
    return (
      <ExamRunner
        sitting={screen.sitting}
        onLeave={() => {
          forgetTicket()
          home()
        }}
      />
    )
  }
  if (screen.name === 'admin' && AdminArea) {
    return (
      <Suspense fallback={<div className="app exam-loading">Loading…</div>}>
        <AdminArea onHome={home} incomingFile={adminFile} />
      </Suspense>
    )
  }
  return (
    <StartScreen
      notice={notice}
      onLab={() => setScreen({ name: 'lab' })}
      onJoin={() => setScreen({ name: 'join', paper: null })}
      onOpenFile={receiveFile}
      onSettings={() => setScreen({ name: 'settings', back: 'home' })}
      onAdmin={AdminArea ? () => setScreen({ name: 'admin' }) : undefined}
    />
  )
}
