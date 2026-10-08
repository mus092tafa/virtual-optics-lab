import type { ComponentKind } from '../physics/types'
import { MAX_LENSES, actions, useLab } from '../state/labState'
import { KIND_NAMES } from './labels'

const ORDER: ComponentKind[] = ['laser', 'tungsten', 'lens', 'object', 'singleSlit', 'doubleSlit', 'screen']

function Icon({ kind }: { kind: ComponentKind }) {
  switch (kind) {
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
    case 'lens':
      return (
        <svg viewBox="0 0 28 20">
          <path d="M14 1 Q21 10 14 19 Q7 10 14 1Z" className="icon-glass" />
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
  const count = (kind: ComponentKind) => components.filter((c) => c.kind === kind).length
  return (
    <aside className="panel palette" aria-label="Components">
      <header className="panel-header">
        <h2>Components</h2>
      </header>
      <ul>
        {ORDER.map((kind) => {
          const present = count(kind)
          const full = kind === 'lens' && present >= MAX_LENSES
          return (
            <li key={kind}>
              <button
                className={`palette-item${present ? ' present' : ''}`}
                disabled={full}
                onClick={() => actions.addComponent(kind)}
                title={kind === 'lens' ? `Add a lens (up to ${MAX_LENSES})` : present ? `Replace the ${KIND_NAMES[kind].toLowerCase()}` : `Add to the bench`}
              >
                <span className="palette-icon">
                  <Icon kind={kind} />
                </span>
                <span>{KIND_NAMES[kind]}</span>
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
