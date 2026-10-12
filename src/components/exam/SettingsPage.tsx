import { useEffect, useState } from 'react'
import { MAX_SAVED_TEACHERS, cleanAddress, loadSettings, saveSettings, validAddress } from '../../exam/settings'
import type { ConnectionSettings, SavedTeacher, Settings } from '../../exam/settings'
import { EDITION, desktop } from '../../platform/desktop'
import type { DiscoveredRoom } from '../../platform/desktop'
import { BrandMark } from './BrandMark'
import { roomDetails, useClassrooms } from './useClassrooms'

interface Props {
  onBack(): void
}

const DEFAULT_PORT = 47800

const MODES: { id: ConnectionSettings['mode']; title: string; text: string }[] = [
  {
    id: 'auto',
    title: 'Find the classroom automatically',
    text: 'Searches the lab network for any teacher’s computer. This works when both computers are on the same Wi-Fi.',
  },
  {
    id: 'address',
    title: 'Use saved teachers’ computers',
    text: 'For a network where the search finds nothing. Several teachers can be saved; the one with a classroom open is the one that appears.',
  },
]

const addressOf = (room: DiscoveredRoom): string => (room.port === DEFAULT_PORT ? room.address : `${room.address}:${room.port}`)

/** What is set up once on a computer, before the students use it. */
export function SettingsPage({ onBack }: Props) {
  const [saved, setSaved] = useState(() => loadSettings(localStorage))
  // The saved-teachers choice can be looked at before a computer is saved; until then the search stays in use.
  const [mode, setMode] = useState(saved.connection.mode)
  const [typed, setTyped] = useState('')
  const [found, setFound] = useState<DiscoveredRoom[] | 'searching' | null>(null)
  const [teacherName, setTeacherName] = useState(saved.teacherName)
  const [info, setInfo] = useState({ version: '', hostName: '' })
  const { rooms, searched } = useClassrooms(saved.connection)
  const { teachers } = saved.connection

  useEffect(() => {
    let cancelled = false
    void desktop()
      .info()
      .then((result) => {
        if (!cancelled) setInfo({ version: result.version, hostName: result.hostName ?? '' })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const store = (next: Settings) => setSaved(saveSettings(next, localStorage))
  const storeConnection = (nextMode: ConnectionSettings['mode'], nextTeachers: SavedTeacher[]) => store({ ...saved, connection: { mode: nextMode, teachers: nextTeachers } })

  const chooseMode = (next: ConnectionSettings['mode']) => {
    setMode(next)
    storeConnection(next, teachers)
  }
  const addTeacher = (teacher: SavedTeacher) => storeConnection('address', [...teachers.filter((entry) => entry.address !== teacher.address), teacher])
  const removeTeacher = (address: string) => storeConnection(mode, teachers.filter((entry) => entry.address !== address))

  const address = cleanAddress(typed)
  const typedWrong = address !== '' && !validAddress(address)
  const full = teachers.length >= MAX_SAVED_TEACHERS

  const findTeachers = async () => {
    setFound('searching')
    setFound(await desktop().discoverClassrooms({ thorough: true }).catch(() => []))
  }

  return (
    <div className="app exam-page">
      <header className="exam-bar">
        <button className="chip" onClick={onBack}>
          ← Back
        </button>
        <BrandMark />
        <h1>Settings</h1>
      </header>

      <main className="exam-scroll">
        <div className="exam-column">
          {EDITION === 'admin' && (
            <section className="panel exam-card">
              <header className="panel-header">
                <h2>Your name</h2>
                <span className="panel-sub">what the students see beside your classroom</span>
              </header>
              <form
                className="exam-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  store({ ...saved, teacherName })
                }}
              >
                <label>
                  <span>Teacher’s name</span>
                  <input className="exam-input" value={teacherName} maxLength={80} placeholder={info.hostName} onChange={(event) => setTeacherName(event.target.value)} />
                </label>
                <p className="hint">
                  Nothing else has to be set on this computer: its address is found by itself when a classroom is opened.
                  {saved.teacherName === '' && info.hostName ? ` Without a name the students see this computer’s name, “${info.hostName}”.` : ''} A change applies to the next classroom you open.
                </p>
                <div className="control-row end">
                  {teacherName.trim() === saved.teacherName && <span className="hint">Saved</span>}
                  <button type="submit" className="chip primary" disabled={teacherName.trim() === saved.teacherName}>
                    Save
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Classroom connection</h2>
              <span className="panel-sub">set once on this computer</span>
            </header>
            <div className="exam-form">
              <div className="option-list" role="radiogroup" aria-label="How this computer finds the classroom">
                {MODES.map((entry) => (
                  <label key={entry.id} className={`option-row${mode === entry.id ? ' active' : ''}`}>
                    <input type="radio" name="connection-mode" checked={mode === entry.id} onChange={() => chooseMode(entry.id)} />
                    <span>
                      <strong>{entry.title}</strong>
                      <span className="option-text">{entry.text}</span>
                    </span>
                  </label>
                ))}
              </div>

              {mode === 'address' && (
                <>
                  <span className="field-label">Saved teachers’ computers</span>
                  {teachers.length === 0 && <p className="empty">None yet, so the automatic search is still in use. Find the teachers below while a classroom is open on their computers.</p>}
                  {teachers.map((teacher) => (
                    <div key={teacher.address} className="room-row">
                      <div>
                        <strong>{teacher.name || 'Teacher’s computer'}</strong>
                        <span className="panel-sub mono">{teacher.address}</span>
                      </div>
                      <button className="chip" onClick={() => removeTeacher(teacher.address)}>
                        Remove
                      </button>
                    </div>
                  ))}

                  <div className="control-row end">
                    <span className="hint">A teacher’s computer answers only while a classroom is open on it.</span>
                    <button className="chip primary" disabled={found === 'searching'} onClick={() => void findTeachers()}>
                      {found === 'searching' ? 'Searching…' : 'Find teachers on this network'}
                    </button>
                  </div>
                  {Array.isArray(found) && found.length === 0 && <p className="empty">No open classroom was found on this network. Ask the teacher to open one and search again, or enter the address shown on the teacher’s classroom screen.</p>}
                  {Array.isArray(found) &&
                    found.map((room) => {
                      const roomAddress = addressOf(room)
                      const isSaved = teachers.some((teacher) => teacher.address === roomAddress)
                      return (
                        <div key={roomAddress} className="room-row found">
                          <div>
                            <strong>{room.teacherName || 'Teacher’s computer'}</strong>
                            <span className="panel-sub">
                              {room.roomName} · <span className="mono">{roomAddress}</span>
                            </span>
                          </div>
                          {isSaved ? (
                            <span className="exam-pill live">saved</span>
                          ) : (
                            <button className="chip primary" disabled={full} onClick={() => addTeacher({ name: room.teacherName, address: roomAddress })}>
                              Save this teacher
                            </button>
                          )}
                        </div>
                      )
                    })}

                  <form
                    className="address-add"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (address === '' || typedWrong || full) return
                      addTeacher({ name: teachers.find((teacher) => teacher.address === address)?.name ?? '', address })
                      setTyped('')
                    }}
                  >
                    <input className="exam-input mono" aria-label="Address of a teacher’s computer" placeholder="or type an address: 192.168.0.10" value={typed} onChange={(event) => setTyped(event.target.value)} />
                    <button type="submit" className="chip" disabled={address === '' || typedWrong || full}>
                      Add
                    </button>
                  </form>
                  {typedWrong && (
                    <p className="notice error" role="alert">
                      This is not an address. It looks like 192.168.0.10, with nothing before or after it.
                    </p>
                  )}
                  {full && <p className="hint">No more than {MAX_SAVED_TEACHERS} computers can be saved; remove one to add another.</p>}
                </>
              )}
            </div>
          </section>

          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Connection check</h2>
              <span className="panel-sub">
                {saved.connection.mode === 'address' ? `asking ${teachers.length === 1 ? (teachers[0].name || teachers[0].address) : `${teachers.length} saved computers`}` : 'searching the network'}
              </span>
            </header>
            <div className="exam-form">
              {!searched && <p className="empty">Looking for a classroom…</p>}
              {searched && rooms.length === 0 && (
                <p className="empty">
                  {saved.connection.mode === 'address'
                    ? 'No classroom answers from the saved computers. Either none is open now, or a computer’s address has changed; in that case find the teachers again.'
                    : 'No classroom found. Either no classroom is open now, or the search does not pass through this network; in that case use saved teachers’ computers.'}
                </p>
              )}
              {rooms.map((room) => (
                <div key={room.base} className="room-row found">
                  <div>
                    <strong>{room.roomName}</strong>
                    <span className="panel-sub">{roomDetails(room)}</span>
                  </div>
                  <span className="exam-pill live">reachable</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel exam-card">
            <header className="panel-header">
              <h2>About</h2>
            </header>
            <dl className="about-list">
              <dt>Edition</dt>
              <dd>{EDITION === 'student' ? 'Student' : 'Teacher'}</dd>
              <dt>Version</dt>
              <dd className="mono">{info.version || '—'}</dd>
            </dl>
          </section>
        </div>
      </main>
    </div>
  )
}
