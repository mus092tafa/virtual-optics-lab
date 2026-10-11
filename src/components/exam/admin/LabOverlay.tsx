import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { LabSnapshot } from '../../../exam/types'
import { actions, labStore } from '../../../state/labState'
import { Header } from '../../Header'
import { LabWorkspace } from '../LabWorkspace'

interface Props {
  title: string
  /** The configuration to show; null keeps the laboratory as the teacher left it. */
  snapshot: LabSnapshot | null
  /** Show the laboratory's own header, to choose an experiment and section. */
  withHeader?: boolean
  children: ReactNode
}

/**
 * The laboratory opened over the teacher's screens, with every value visible:
 * to prepare the bench of a question, or to look at the bench a student left.
 * The teacher's own laboratory is put back when it closes.
 */
export function LabOverlay({ title, snapshot, withHeader = false, children }: Props) {
  useEffect(() => {
    const before = labStore.get()
    actions.loadSnapshot(snapshot ?? actions.exportSnapshot(), { mode: 'learning' })
    return () => actions.restore(before)
  }, [snapshot])

  return (
    <div className="app lab-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="exam-bar">
        <h1>{title}</h1>
        <span className="exam-bar-space" />
        {children}
      </div>
      {withHeader && <Header />}
      <LabWorkspace />
    </div>
  )
}
