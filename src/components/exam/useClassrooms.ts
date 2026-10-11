import { useEffect, useState } from 'react'
import type { ConnectionSettings } from '../../exam/settings'
import { classroomUrl, fetchRoom } from '../../exam/sitting'
import { desktop } from '../../platform/desktop'

/** A classroom this computer can join now. */
export interface FoundRoom {
  base: string
  roomName: string
  examTitle: string
  state: string
}

const SEARCH_INTERVAL_MS = 3000

export const ROOM_STATE_LABELS: Record<string, string> = { lobby: 'waiting to start', running: 'in progress', ended: 'ended' }

async function findRooms(connection: ConnectionSettings): Promise<FoundRoom[]> {
  if (connection.mode === 'address') {
    const base = classroomUrl(connection.address)
    const room = await fetchRoom(base)
    return [{ base, roomName: room.roomName, examTitle: room.examTitle, state: room.state }]
  }
  const rooms = await desktop().discoverClassrooms()
  return rooms.map((room) => ({ base: classroomUrl(room.address, room.port), roomName: room.roomName, examTitle: room.examTitle, state: room.state }))
}

/**
 * The classrooms reachable with the computer's connection settings, looked up
 * again every few seconds while mounted. Pass null to stay off the network.
 */
export function useClassrooms(connection: ConnectionSettings | null): { rooms: FoundRoom[]; searched: boolean } {
  const key = connection ? `${connection.mode}|${connection.address}` : null
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
