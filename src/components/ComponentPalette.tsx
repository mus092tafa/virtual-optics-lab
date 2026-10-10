import type { BenchComponent, ComponentKind } from '../physics/types'
import { cm } from '../physics/units'
import { MAX_LENSES, MAX_POLARIZERS, actions, useLab } from '../state/labState'
import { KIND_NAMES } from './labels'

interface PaletteEntry {
  id: string
  kind: ComponentKind
  label: string
  /** Settings that distinguish this entry from the default component of its kind. */
  overrides?: Partial<BenchComponent>
  matches(component: BenchComponent): boolean
}

const ENTRIES: PaletteEntry[] = [
  { id: 'laser', kind: 'laser', label: KIND_NAMES.laser, matches: (c) => c.kind === 'laser' },
  { id: 'tungsten', kind: 'tungsten', label: KIND_NAMES.tungsten, matches: (c) => c.kind === 'tungsten' },
  { id: 'convex', kind: 'lens', label: 'Convex lens', matches: (c) => c.kind === 'lens' && c.focalLength > 0 },
  {
    id: 'concave',
    kind: 'lens',
    label: 'Concave lens',
    overrides: { focalLength: -cm(15) },
    matches: (c) => c.kind === 'lens' && c.focalLength < 0,
  },
  { id: 'mirror', kind: 'mirror', label: KIND_NAMES.mirror, matches: (c) => c.kind === 'mirror' },
  { id: 'object', kind: 'object', label: KIND_NAMES.object, matches: (c) => c.kind === 'object' },
  { id: 'singleSlit', kind: 'singleSlit', label: KIND_NAMES.singleSlit, matches: (c) => c.kind === 'singleSlit' },
  { id: 'doubleSlit', kind: 'doubleSlit', label: KIND_NAMES.doubleSlit, matches: (c) => c.kind === 'doubleSlit' },
  { id: 'grating', kind: 'grating', label: KIND_NAMES.grating, matches: (c) => c.kind === 'grating' },
  { id: 'pinhole', kind: 'pinhole', label: KIND_NAMES.pinhole, matches: (c) => c.kind === 'pinhole' },
  { id: 'polarizer', kind: 'polarizer', label: KIND_NAMES.polarizer, matches: (c) => c.kind === 'polarizer' },
  { id: 'screen', kind: 'screen', label: KIND_NAMES.screen, matches: (c) => c.kind === 'screen' },
]

/** Kinds of which several can be mounted, with their limit. */
const LIMITS: Partial<Record<ComponentKind, number>> = { lens: MAX_LENSES, polarizer: MAX_POLARIZERS }

function Icon({ id }: { id: string }) {
  switch (id) {
    case 'laser':
      return (
        <svg viewBox="0 0 28 20">
          <rect x={2} y={6} width={16} height={8} rx={1.5} className="icon-body" />
          <line x1={18} x2={27} y1={10} y2={10} stroke="#ff3b30" strokeWidth={1.6} />
        </svg>
      )
    case 'tungsten':
      return (
        <svg viewBox="0 0 28 20">
          <circle cx={11} cy={10} r={5.5} fill="#ffb454" />
          <path d="M19 5l5-3M20 10h6M19 15l5 3" stroke="#ffb454" strokeWidth={1.4} fill="none" />
        </svg>
      )
    case 'convex':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M14 1 Q21 10 14 19 Q7 10 14 1Z" className="icon-glass" />
        </svg>
      )
    case 'concave':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M10 1 L18 1 Q14 10 18 19 L10 19 Q14 10 10 1Z" className="icon-glass" />
        </svg>
      )
    case 'mirror':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M12 1 Q19 10 12 19" fill="none" stroke="#e6edf3" strokeWidth={2} />
          <path d="M3 6 L15 9 L3 14" fill="none" stroke="#ffb454" strokeWidth={1.2} />
        </svg>
      )
    case 'grating':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M11 2v16M14 2v16M17 2v16" stroke="#c9d4e0" strokeWidth={1.4} />
        </svg>
      )
    case 'pinhole':
      return (
        <svg viewBox="0 0 28 20">
          <rect x={7} y={3} width={14} height={14} rx={2} className="icon-body" />
          <circle cx={14} cy={10} r={2} fill="#e6edf3" />
        </svg>
      )
    case 'polarizer':
      return (
        <svg viewBox="0 0 28 20">
          <circle cx={14} cy={10} r={7.5} className="icon-body" />
          <line x1={14} x2={14} y1={3} y2={17} stroke="#ffd166" strokeWidth={1.6} />
        </svg>
      )
    case 'object':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M14 18V7M14 2l4 6h-8z" stroke="#ffd166" fill="#ffd166" strokeWidth={1.8} />
        </svg>
      )
    case 'singleSlit':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M14 1v7M14 12v7" className="icon-plate" />
        </svg>
      )
    case 'doubleSlit':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M14 1v5M14 8.5v3M14 14v5" className="icon-plate" />
        </svg>
      )
    case 'screen':
      return (
        <svg viewBox="0 0 28 20">
          <rect x={12} y={1} width={4} height={18} rx={1} fill="#e6edf3" />
        </svg>
      )
  }
}

export function ComponentPalette() {
  const components = useLab((s) => s.components)
  return (
    <aside className="panel palette" aria-label="Components">
      <header className="panel-header">
        <h2>Components</h2>
      </header>
      <ul>
        {ENTRIES.map((entry) => {
          const present = components.filter(entry.matches).length
          const limit = LIMITS[entry.kind]
          const full = limit !== undefined && components.filter((c) => c.kind === entry.kind).length >= limit
          return (
            <li key={entry.id}>
              <button
                className={`palette-item${present ? ' present' : ''}`}
                disabled={full}
                onClick={() => actions.addComponent(entry.kind, entry.overrides)}
                title={limit !== undefined ? `Add a ${entry.label.toLowerCase()} (up to ${limit} ${entry.kind === 'lens' ? 'lenses' : 'polarisers'})` : present ? `Replace the ${entry.label.toLowerCase()}` : `Add to the bench`}
              >
                <span className="palette-icon">
                  <Icon id={entry.id} />
                </span>
                <span>{entry.label}</span>
                {present > 0 && <span className="palette-count">{present}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="palette-help">Click to mount on the rail, then drag. Arrow keys nudge by 1 mm (Shift: 1 cm); Delete removes.</p>
    </aside>
  )
}
