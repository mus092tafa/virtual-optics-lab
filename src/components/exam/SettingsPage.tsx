import { useEffect, useState } from 'react'
import { cleanAddress, loadSettings, saveSettings, validAddress } from '../../exam/settings'
import type { ConnectionSettings } from '../../exam/settings'
import { EDITION, desktop } from '../../platform/desktop'
import { BrandMark } from './BrandMark'
import { ROOM_STATE_LABELS, useClassrooms } from './useClassrooms'

interface Props {
  onBack(): void
}

const MODES: { id: ConnectionSettings['mode']; title: string; text: string }[] = [
  {
    id: 'auto',
    title: 'Find the classroom automatically',
    text: 'Searches the lab network for the teacher’s computer. This works when both computers are on the same Wi-Fi.',
  },
  {
    id: 'address',
    title: 'Use the teacher’s address',
    text: 'For a network where the search finds nothing. The address is shown on the teacher’s classroom screen.',
  },
]

/** What is set up once on a computer, before the students use it. */
export function SettingsPage({ onBack }: Props) {
  const [saved, setSaved] = useState(() => loadSettings(localStorage))
  const [draft, setDraft] = useState(saved.connection)
  const [version, setVersion] = useState('')
  const { rooms, searched } = useClassrooms(saved.connection)

  useEffect(() => {
    let cancelled = false
    void desktop()
      .info()
      .then((info) => {
        if (!cancelled) setVersion(info.version)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const address = cleanAddress(draft.address)
  const addressMissing = draft.mode === 'address' && address === ''
  const addressWrong = draft.mode === 'address' && address !== '' && !validAddress(address)
  const changed = draft.mode !== saved.connection.mode || (draft.mode === 'address' && address !== saved.connection.address)

  const save = () => {
    const stored = saveSettings({ ...saved, connection: { mode: draft.mode, address: draft.mode === 'address' ? address : saved.connection.address } }, localStorage)
    setSaved(stored)
    setDraft(stored.connection)
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
          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Classroom connection</h2>
              <span className="panel-sub">set once on this computer</span>
            </header>
            <form
              className="exam-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (changed && !addressMissing && !addressWrong) save()
              }}
            >
              <div className="option-list" role="radiogroup" aria-label="How this computer finds the classroom">
                {MODES.map((mode) => (
                  <label key={mode.id} className={`option-row${draft.mode === mode.id ? ' active' : ''}`}>
                    <input type="radio" name="connection-mode" checked={draft.mode === mode.id} onChange={() => setDraft({ ...draft, mode: mode.id })} />
                    <span>
                      <strong>{mode.title}</strong>
                      <span className="option-text">{mode.text}</span>
                    </span>
                  </label>
                ))}
              </div>

              {draft.mode === 'address' && (
                <label>
                  <span>Address of the teacher’s computer</span>
                  <input className="exam-input mono" placeholder="192.168.0.10" value={draft.address} autoFocus onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
                </label>
              )}
              {addressWrong && (
                <p className="notice error" role="alert">
                  This is not an address. It looks like 192.168.0.10, with nothing before or after it.
                </p>
              )}

              <div className="control-row end">
                {!changed && <span className="hint">Saved</span>}
                <button type="submit" className="chip primary" disabled={!changed || addressMissing || addressWrong}>
                  Save
                </button>
              </div>
            </form>
          </section>

          <section className="panel exam-card">
            <header className="panel-header">
              <h2>Connection check</h2>
              <span className="panel-sub">
                {saved.connection.mode === 'address' ? `asking ${saved.connection.address}` : 'searching the network'}
                {changed ? ' · the saved setting, not the change above' : ''}
              </span>
            </header>
            <div className="exam-form">
              {!searched && <p className="empty">Looking for a classroom…</p>}
              {searched && rooms.length === 0 && (
                <p className="empty">
                  {saved.connection.mode === 'address'
                    ? 'No classroom answers at this address. Check the address, and that the teacher has opened a classroom.'
                    : 'No classroom found. Either no classroom is open now, or the search does not pass through this network; in that case use the teacher’s address.'}
                </p>
              )}
              {rooms.map((room) => (
                <div key={room.base} className="room-row found">
                  <div>
                    <strong>{room.roomName}</strong>
                    <span className="panel-sub">
                      {room.examTitle} · {ROOM_STATE_LABELS[room.state] ?? room.state}
                    </span>
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
              <dd className="mono">{version || '—'}</dd>
            </dl>
          </section>
        </div>
      </main>
    </div>
  )
}
