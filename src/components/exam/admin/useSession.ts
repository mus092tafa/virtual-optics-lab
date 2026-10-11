import { useEffect, useState } from 'react'
import type { SessionRecord } from '../../../exam/types'
import { desktop, normalizeSession } from '../../../platform/desktop'
import type { ClassroomStatus } from '../../../platform/desktop'

/** A sitting from the records, kept up to date while students work and the teacher marks. */
export function useSession(sessionId: string): { session: SessionRecord | null; missing: boolean } {
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let cancelled = false
    void desktop()
      .loadSession(sessionId)
      .then((loaded) => {
        if (cancelled) return
        if (loaded) setSession(normalizeSession(loaded))
        else setMissing(true)
      })
    const unsubscribe = desktop().onSessionUpdate((updated) => {
      if (updated.id === sessionId) setSession(normalizeSession(updated))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [sessionId])
  return { session, missing }
}

/** The classroom that is open on the network, if any. */
export function useClassroom(): { classroom: ClassroomStatus | null; set(status: ClassroomStatus | null): void } {
  const [classroom, setClassroom] = useState<ClassroomStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    void desktop()
      .classroomStatus()
      .then((status) => {
        if (!cancelled) setClassroom(status)
      })
    // The sitting changes as students work; the network details do not.
    const unsubscribe = desktop().onSessionUpdate((updated) => setClassroom((current) => (current?.session.id === updated.id ? { ...current, session: updated } : current)))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
  return { classroom, set: setClassroom }
}
