/**
 * What is set up once on a computer and then left alone: how it reaches the
 * teacher's classroom. Kept apart from the sittings so that an exam never
 * changes it.
 */
import type { KeyValueStore } from './sitting'

/** A teacher's computer this one asks for a classroom. */
export interface SavedTeacher {
  /** The teacher's name as it was shown when the computer was saved; empty when the address was typed. */
  name: string
  /** "192.168.1.10" or "192.168.1.10:47800". */
  address: string
}

export interface ConnectionSettings {
  /** 'auto' searches the lab network; 'address' asks the saved teachers' computers. */
  mode: 'auto' | 'address'
  /** Used in the 'address' mode only. */
  teachers: SavedTeacher[]
}

export interface Settings {
  connection: ConnectionSettings
  /** Teacher's edition: the name students see beside the classroom. Empty shows the computer's name. */
  teacherName: string
}

export const DEFAULT_SETTINGS: Settings = { connection: { mode: 'auto', teachers: [] }, teacherName: '' }

export const MAX_SAVED_TEACHERS = 12
const NAME_LENGTH = 80

const SETTINGS_KEY = 'virtual-optics-lab/settings'
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i
const MAX_PORT = 65535

/** The address as it is stored: without a scheme, a path or surrounding spaces. */
export function cleanAddress(address: string): string {
  return address.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/** Whether the text names a computer, with or without a port. */
export function validAddress(address: string): boolean {
  const [host, port, ...rest] = cleanAddress(address).split(':')
  if (rest.length > 0 || !HOST.test(host)) return false
  return port === undefined || (/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= MAX_PORT)
}

const cleanName = (name: unknown): string => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH) : '')

/** The saved computers reduced to well-formed ones, each address once. */
function parseTeachers(value: unknown): SavedTeacher[] {
  const teachers = new Map<string, SavedTeacher>()
  for (const entry of Array.isArray(value) ? value : []) {
    const address = typeof entry?.address === 'string' ? cleanAddress(entry.address) : ''
    if (validAddress(address) && !teachers.has(address)) teachers.set(address, { name: cleanName(entry.name), address })
  }
  return [...teachers.values()].slice(0, MAX_SAVED_TEACHERS)
}

/** Settings read from storage, reduced to well-formed ones; anything unusable falls back to the default. */
export function parseSettings(value: unknown): Settings {
  const stored = value as { connection?: { mode?: unknown; teachers?: unknown; address?: unknown }; teacherName?: unknown } | null
  const connection = stored?.connection
  // Before several teachers could be saved there was one address.
  const teachers = parseTeachers([...(Array.isArray(connection?.teachers) ? connection.teachers : []), { name: '', address: connection?.address }])
  // With no computer to ask, the computer would be unable to join: search instead.
  const mode = connection?.mode === 'address' && teachers.length > 0 ? 'address' : 'auto'
  return { connection: { mode, teachers }, teacherName: cleanName(stored?.teacherName) }
}

export function loadSettings(store: KeyValueStore): Settings {
  try {
    return parseSettings(JSON.parse(store.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return parseSettings(null)
  }
}

/** Stores the settings and returns them as they were stored. */
export function saveSettings(settings: Settings, store: KeyValueStore): Settings {
  const stored = parseSettings(settings)
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(stored))
  } catch {
    // Storage may be unavailable; the settings then last until the application is closed.
  }
  return stored
}
