import { useEffect, useState } from 'react'
import type { ConnectionSettings } from '../../exam/settings'
import { classroomUrl, fetchRoom } from '../../exam/sitting'
import { desktop } from '../../platform/desktop'

/** A classroom this computer can join now. */
export interface FoundRoom {
  base: string
  /** The teacher who opened it; empty when the teacher's computer does not say. */
  teacherName: string
  roomName: string
  examTitle: string
  state: string
}

const SEARCH_INTERVAL_MS = 3000

export const ROOM_STATE_LABELS: Record<string, string> = { lobby: 'waiting to start', running: 'in progress', ended: 'ended' }

async function findRooms(connection: ConnectionSettings): Promise<FoundRoom[]> {
  if (connection.mode === 'address') {
    // Every saved teacher is asked; the ones with a classroom open answer.
    const answers = await Promise.allSettled(
      connection.teachers.map(async (teacher): Promise<FoundRoom> => {
        const base = classroomUrl(teacher.address)
        const room = await fetchRoom(base)
        return { base, teacherName: room.teacherName || teacher.name, roomName: room.roomName, examTitle: room.examTitle, state: room.state }
      }),
    )
    return answers.flatMap((answer) => (answer.status === 'fulfilled' ? [answer.value] : []))
  }
  const rooms = await desktop().discoverClassrooms()
  return rooms.map((room) => ({ base: classroomUrl(room.address, room.port), teacherName: room.teacherName ?? '', roomName: room.roomName, examTitle: room.examTitle, state: room.state }))
}

/** "Dr. Hassan · Optics midterm · waiting to start": what a student reads under the name of a classroom. */
export function roomDetails(room: Pick<FoundRoom, 'teacherName' | 'examTitle' | 'state'>): string {
  return [room.teacherName, room.examTitle, ROOM_STATE_LABELS[room.state] ?? room.state].filter(Boolean).join(' · ')
}

/**
 * The classrooms reachable with the computer's connection settings, looked up
 * again every few seconds while mounted. Pass null to stay off the network.
 */
export function useClassrooms(connection: ConnectionSettings | null): { rooms: FoundRoom[]; searched: boolean } {
  const key = connection ? `${connection.mode}|${connection.teachers.map((teacher) => teacher.address).join(',')}` : null
  const [result, setResult] = useState<{ key: string; rooms: FoundRoom[] } | null>(null)

  useEffect(() => {
    if (!connection || key === null) return
    let cancelled = false
    let timer = 0
    // One look-up at a time: an unreachable address takes seconds to give up.
    const search = async () => {
      const rooms = await findRooms(connection).catch(() => [])
      if (cancelled) return
      setResult({ key, rooms })
      timer = window.setTimeout(search, SEARCH_INTERVAL_MS)
    }
    void search()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // `key` stands for the connection settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = result !== null && result.key === key
  return { rooms: current ? result.rooms : [], searched: current }
}
