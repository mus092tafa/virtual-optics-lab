import type { ReactNode } from 'react'
import { EXPERIMENTS, experiment } from '../../education/experiments'
import { TOPICS } from '../../education/topics'
import { FILE_EXTENSIONS } from '../../exam/format'
import { EDITION, desktop, hasDesktop } from '../../platform/desktop'
import { actions, useLab } from '../../state/labState'
import type { OpenedFile } from '../../platform/desktop'
import { BrandMark } from './BrandMark'

interface Props {
  notice: string
  onLab(): void
  onJoin(): void
  onOpenFile(file: OpenedFile): void
  onSettings(): void
  /** Absent in the student edition. */
  onAdmin?: () => void
}

const ICONS = {
  join: <path d="M4 6h16v10H4zM9 20h6M12 16v4M8.5 11l2.5 2.5 4.5-5" />,
  file: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  teacher: <path d="M5 4h14v16H5zM9 2v4M15 2v4M8.5 11h7M8.5 15h4" />,
}

interface TileProps {
  tone: 'exam' | 'teacher'
  icon: ReactNode
  title: string
  text: string
  disabled: boolean
  onClick(): void
}

function Tile({ tone, icon, title, text, disabled, onClick }: TileProps) {
  return (
    <button className={`start-tile ${tone}`} onClick={onClick} disabled={disabled}>
      <span className="start-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {icon}
        </svg>
      </span>
      <span className="start-tile-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <span className="start-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}

/** First screen of the application: the free laboratory or one of the exam modes. */
export function StartScreen({ notice, onLab, onJoin, onOpenFile, onSettings, onAdmin }: Props) {
  const exams = hasDesktop()
  const current = experiment(useLab((state) => state.experiment))

  const openExamFile = async () => {
    const file = await desktop().openFile({ title: 'Open an exam file', extensions: [FILE_EXTENSIONS.paper], label: 'Exam file' })
    if (file) onOpenFile(file)
  }

  return (
    <div className="app start-screen">
      <header className="app-header">
        <div className="header-top">
          <div className="brand">
            <BrandMark />
            <div>
              <h1>Virtual Optics Laboratory</h1>
              <p>Physically modelled optical bench for engineering students</p>
            </div>
          </div>
          <span className="start-edition">{EDITION === 'student' ? 'Student edition' : 'Teacher’s edition'}</span>
          <button className="chip" onClick={onSettings} disabled={!exams} title="Set up this computer">
            Settings
          </button>
        </div>
      </header>

      <main className="start-scroll">
        <div className="start-layout">
          {notice && (
            <p className="notice warning" role="alert">
              {notice}
            </p>
          )}

          <div className="start-columns">
            <section className="start-group">
              <h2 className="presets-label">Laboratory · {EXPERIMENTS.length} experiments</h2>
              <button className="start-tile lab" onClick={onLab}>
                <span className="start-icon">
                  <BrandMark />
                </span>
                <span className="start-tile-text">
                  <strong>Continue in the laboratory</strong>
                  <span>
                    Where you left off: {current.number} · {current.title}
                  </span>
                </span>
                <span className="start-arrow" aria-hidden="true">
                  →
                </span>
              </button>

              {TOPICS.map((topic) => (
                <div key={topic.id} className="catalogue-topic" data-topic={topic.id}>
                  <h3>
                    <span className="topic-dot" aria-hidden="true" />
                    {topic.name}
                  </h3>
                  <div className="catalogue-grid">
                    {topic.experiments.map(experiment).map((entry) => (
                      <button
                        key={entry.id}
                        className="catalogue-card"
                        onClick={() => {
                          actions.loadExperiment(entry.id)
                          onLab()
                        }}
                      >
                        <span className="preset-number">{entry.number}</span>
                        <span className="catalogue-text">
                          <strong>{entry.title}</strong>
                          <span>{entry.goal}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <div className="start-side">
              <section className="start-group">
                <h2 className="presets-label">Exam</h2>
                <Tile tone="exam" icon={ICONS.join} title="Join an exam" text="Enter your teacher’s classroom and sit the exam." disabled={!exams} onClick={onJoin} />
                <Tile
                  tone="exam"
                  icon={ICONS.file}
                  title="Open an exam file"
                  text={`Sit an exam from a .${FILE_EXTENSIONS.paper} file on this computer, without the network.`}
                  disabled={!exams}
                  onClick={openExamFile}
                />
              </section>

              {onAdmin && (
                <section className="start-group">
                  <h2 className="presets-label">Teacher</h2>
                  <Tile tone="teacher" icon={ICONS.teacher} title="Exams — teacher" text="Write exams, open a classroom, mark the answers and keep the records." disabled={!exams} onClick={onAdmin} />
                </section>
              )}
            </div>
          </div>

          {!exams && <p className="hint">The exam modes need the desktop application; in a browser only the free laboratory is available.</p>}
        </div>
      </main>
    </div>
  )
}
