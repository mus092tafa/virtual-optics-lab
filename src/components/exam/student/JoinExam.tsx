import { useCallback, useState } from 'react'
import { loadSettings } from '../../../exam/settings'
import { SittingError, fileSitting, joinClassroom, localSittingOwner } from '../../../exam/sitting'
import type { Sitting } from '../../../exam/sitting'
import type { ExamPaper } from '../../../exam/types'
import { BrandMark } from '../BrandMark'
import { plural } from '../shared'
import { ROOM_STATE_LABELS, useClassrooms } from '../useClassrooms'
import { deviceId, saveTicket } from './ticket'

interface Props {
  /** The exam file to sit; null to join the teacher's classroom. */
  paper: ExamPaper | null
  onBack(): void
  /** Opens the settings of this computer, where the connection to the classroom is set up. */
  onSettings(): void
  onStart(sitting: Sitting): void
}

/** Asks for the student's name and class, then enters the classroom or starts an exam file. */
export function JoinExam({ paper, onBack, onSettings, onStart }: Props) {
  // A sitting of this file still running on this laptop is continued by the student who began it.
  const [owner] = useState(() => (paper ? localSittingOwner(paper, localStorage) : null))
  const [name, setName] = useState(owner?.name ?? '')
  const [className, setClassName] = useState(owner?.className ?? '')
  const [connection] = useState(() => loadSettings(localStorage).connection)
  const { rooms, searched } = useClassrooms(paper ? null : connection)
  const [chosen, setChosen] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const identified = name.trim() !== '' && className.trim() !== ''
  // With one classroom open there is nothing to choose.
  const room = rooms.find((candidate) => candidate.base === chosen) ?? (rooms.length === 1 ? rooms[0] : null)

  const join = useCallback(
    async (base: string) => {
      setBusy(true)
      setError('')
      try {
        const { sitting, ticket } = await joinClassroom(base, { name: name.trim(), className: className.trim(), deviceId: deviceId() })
        saveTicket(ticket)
        onStart(sitting)
      } catch (failure) {
        setError(failure instanceof SittingError ? failure.message : 'Could not join the classroom.')
        setBusy(false)
      }
    },
    [name, className, onStart],
  )

  const blocked = !identified
    ? 'Enter your name and class first.'
    : !room
      ? rooms.length > 1
        ? 'Choose your classroom.'
        : ''
      : room.state === 'ended'
        ? 'This exam has ended.'
        : ''

  return (
    <div className="app exam-page">
      <header className="exam-bar">
        <button className="chip" onClick={onBack}>
          ← Start
        </button>
        <BrandMark />
        <h1>{paper ? paper.title : 'Join an exam'}</h1>
        {!paper && (
          <>
            <span className="exam-bar-space" />
            <button className="chip" onClick={onSettings} title="How this computer finds the classroom">
              Connection settings
            </button>
          </>
        )}
      </header>

      <main className="exam-scroll">
        <div className="exam-column">
          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Who are you?</h2>
            </header>
            <div className="exam-form">
              <label>
                <span>Full name</span>
                <input className="exam-input" value={name} maxLength={80} disabled={owner !== null} autoFocus onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span>Class</span>
                <input className="exam-input" value={className} maxLength={80} disabled={owner !== null} onChange={(event) => setClassName(event.target.value)} />
              </label>
              {owner && <p className="hint">This exam was already started on this computer and its clock is running. It continues under the name it was started with.</p>}
            </div>
          </section>

          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}

          {paper ? (
            <section className="panel exam-card">
              <header className="panel-header">
                <h2>The exam</h2>
              </header>
              <div className="exam-form">
                <p>
                  {plural(paper.questions.length, 'question')} · {paper.durationMinutes} minutes
                  {paper.course ? ` · ${paper.course}` : ''}
                </p>
                {paper.instructions.trim() && <p className="exam-prompt">{paper.instructions}</p>}
                <p className="hint">The clock starts when you press the button and keeps running if the application is closed.</p>
                <div className="control-row end">
                  <button className="chip primary large" disabled={!identified} onClick={() => onStart(fileSitting(paper, { name: name.trim(), className: className.trim() }, localStorage))}>
                    {owner ? 'Continue the exam' : 'Start the exam'}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="panel exam-card">
              <header className="panel-header">
                <h2>Your classroom</h2>
              </header>
              <div className="exam-form">
                {!searched && <p className="empty">Looking for your teacher’s classroom…</p>}
                {searched && rooms.length === 0 && <p className="empty">No classroom is open yet. Wait for your teacher to open it; it appears here by itself.</p>}
                {rooms.length === 1 && (
                  <div className="room-row found">
                    <div>
                      <strong>{rooms[0].roomName}</strong>
                      <span className="panel-sub">
                        {rooms[0].examTitle} · {ROOM_STATE_LABELS[rooms[0].state] ?? rooms[0].state}
                      </span>
                    </div>
                  </div>
                )}
                {rooms.length > 1 && (
                  <div className="option-list" role="radiogroup" aria-label="Classroom">
                    {rooms.map((entry) => (
                      <label key={entry.base} className={`option-row${room?.base === entry.base ? ' active' : ''}`}>
                        <input type="radio" name="classroom" checked={room?.base === entry.base} onChange={() => setChosen(entry.base)} />
                        <span>
                          <strong>{entry.roomName}</strong>
                          <span className="option-text">
                            {entry.examTitle} · {ROOM_STATE_LABELS[entry.state] ?? entry.state}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="control-row end">
                  {blocked && <span className="hint">{blocked}</span>}
                  <button className="chip primary large" disabled={!room || blocked !== '' || busy} onClick={() => room && join(room.base)}>
                    Join the exam
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
