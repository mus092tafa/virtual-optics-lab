import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, cleanAddress, loadSettings, parseSettings, saveSettings, validAddress } from '../settings'
import { classroomUrl } from '../sitting'

function memoryStore() {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

describe('classroom address', () => {
  it('accepts a computer with or without a port', () => {
    for (const address of ['192.168.0.10', '192.168.0.10:47800', 'teacher-laptop', 'teacher.local:8080', ' http://192.168.0.10/ ']) expect(validAddress(address)).toBe(true)
  })

  it('rejects what cannot be an address', () => {
    for (const address of ['', '   ', '192.168.0.10:', '192.168.0.10:0', '192.168.0.10:70000', '192.168.0.10:47800:1', 'lab wifi', '192.168.0.10/room', '-teacher']) {
      expect(validAddress(address)).toBe(false)
    }
  })

  it('is stored without scheme, path or spaces and still gives the classroom its base address', () => {
    expect(cleanAddress('  http://192.168.0.10/ ')).toBe('192.168.0.10')
    expect(classroomUrl(cleanAddress(' http://192.168.0.10/ '))).toBe('http://192.168.0.10:47800')
    expect(classroomUrl(cleanAddress('192.168.0.10:5000'))).toBe('http://192.168.0.10:5000')
  })
})

describe('settings', () => {
  it('search the network when nothing has been set', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS)
  })

  it('survive a restart', () => {
    const store = memoryStore()
    saveSettings({ connection: { mode: 'address', teachers: [{ name: ' Dr.  Hassan ', address: ' 192.168.0.10 ' }] }, teacherName: ' Dr. Mawla ' }, store)
    expect(loadSettings(store)).toEqual({ connection: { mode: 'address', teachers: [{ name: 'Dr. Hassan', address: '192.168.0.10' }] }, teacherName: 'Dr. Mawla' })
  })

  it('keep the saved computers when the search is chosen again', () => {
    const teachers = [{ name: 'Dr. Hassan', address: '192.168.0.10' }]
    expect(parseSettings({ connection: { mode: 'auto', teachers } }).connection).toEqual({ mode: 'auto', teachers })
  })

  it('keep several teachers, each computer once', () => {
    const { connection } = parseSettings({
      connection: {
        mode: 'address',
        teachers: [
          { name: 'Dr. Hassan', address: '192.168.0.10' },
          { name: 'Dr. Salim', address: '192.168.0.11' },
          { name: 'Again', address: 'http://192.168.0.10/' },
          { name: 'Nobody', address: 'not an address' },
        ],
      },
    })
    expect(connection.mode).toBe('address')
    expect(connection.teachers).toEqual([
      { name: 'Dr. Hassan', address: '192.168.0.10' },
      { name: 'Dr. Salim', address: '192.168.0.11' },
    ])
  })

  it('take over the single address saved by an earlier version', () => {
    expect(parseSettings({ connection: { mode: 'address', address: '192.168.0.10' } }).connection).toEqual({ mode: 'address', teachers: [{ name: '', address: '192.168.0.10' }] })
  })

  it('fall back to the search when what is stored is unusable', () => {
    expect(parseSettings({ connection: { mode: 'address', address: 'not an address' } })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ connection: { mode: 'address' } })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ connection: { mode: 'address', teachers: 'nonsense' }, teacherName: 7 })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    const store = memoryStore()
    store.setItem('virtual-optics-lab/settings', '{broken')
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS)
  })
})
