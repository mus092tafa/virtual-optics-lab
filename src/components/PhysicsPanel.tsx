import { actions, theoryVisible, useLab } from '../state/labState'
import type { Notice } from '../physics/optics'
import type { ReportSection } from './report'

interface Props {
  sections: ReportSection[]
  notices: Notice[]
}

/** Live numerical read-out of the system. Calculated results are withheld in experiment mode. */
export function PhysicsPanel({ sections, notices }: Props) {
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  return (
    <section className="panel physics" aria-label="Physics">
      <header className="panel-header">
        <h2>Physics</h2>
        {mode === 'experiment' && (
          <button className="chip" onClick={() => actions.setRevealed(!revealed)}>
            {revealed ? 'Hide theory' : 'Reveal theory'}
          </button>
        )}
      </header>
      <div className="physics-body">
        {notices.map((notice, index) => (
          <p key={index} className={`notice ${notice.level}`} role={notice.level === 'error' ? 'alert' : undefined}>
            {notice.text}
          </p>
        ))}
        {sections.map((section) => (
          <div key={section.title} className="report-section">
            <h3>{section.title}</h3>
            <dl>
              {section.rows.map((row, index) => (
                <div key={index} className={`report-row${row.label.startsWith('  ') ? ' sub' : ''}`}>
                  <dt>{row.label.trim()}</dt>
                  <dd className={row.theory && !showTheory ? 'withheld' : undefined}>{row.theory && !showTheory ? 'to be measured' : row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
