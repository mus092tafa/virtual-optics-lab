/**
 * What is set up once on a computer and then left alone: how it reaches the
 * teacher's classroom. Kept apart from the sittings so that an exam never
 * changes it.
 */
import type { KeyValueStore } from './sitting'

export interface ConnectionSettings {
  /** 'auto' searches the lab network; 'address' always asks one teacher's computer. */
  mode: 'auto' | 'address'
  /** "192.168.1.10" or "192.168.1.10:47800"; used in the 'address' mode only. */
  address: string
}

export interface Settings {
  connection: ConnectionSettings
}

export const DEFAULT_SETTINGS: Settings = { connection: { mode: 'auto', address: '' } }

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

/** Settings read from storage, reduced to well-formed ones; anything unusable falls back to the default. */
export function parseSettings(value: unknown): Settings {
  const connection = (value as { connection?: Partial<ConnectionSettings> } | null)?.connection
  const address = typeof connection?.address === 'string' ? cleanAddress(connection.address) : ''
  // A fixed address that cannot be one would leave the computer unable to join: search instead.
  const mode = connection?.mode === 'address' && validAddress(address) ? 'address' : 'auto'
  return { connection: { mode, address: validAddress(address) ? address : '' } }
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
