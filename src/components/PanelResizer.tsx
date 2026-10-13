import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { PanelLimits } from './hooks'

const KEY_STEP = 24
/** Space between two panels; the handle lies in the middle of it. */
const GAP = 8

/** An absolutely placed grid item runs on to the edge of the grid unless both of its lines are named. */
const tracks = (placement: number | string) => (typeof placement === 'number' ? `${placement} / ${placement + 1}` : placement)

interface Props extends PanelLimits {
  /** What the handle resizes, for screen readers and the tooltip. */
  label: string
  /** x: the handle stands between two columns and sets a width; y: it lies between two rows and sets a height. */
  axis: 'x' | 'y'
  /** Which neighbour in the document the handle resizes; the other one takes what is left. */
  target: 'previous' | 'next'
  /** The track just after the handle, and the tracks it runs along: one track by its number, several as "1 / 3". */
  column: number | string
  row: number | string
  size: number | null
  onChange: (size: number | null) => void
}

/**
 * The handle in the gap between two panels of a grid. Dragging it sets the size of one of them, the arrow keys change
 * it in steps and a double click returns it to the layout's own size.
 */
export function PanelResizer({ label, axis, target, column, row, size, onChange, min, maxShare }: Props) {
  const [dragging, setDragging] = useState(false)

  /** The panel's size with the handle at a position along the axis; with none, its size as it is. */
  const sizeFor = (handle: HTMLElement, pointer: number | null, change = 0) => {
    const panel = (target === 'previous' ? handle.previousElementSibling : handle.nextElementSibling)!.getBoundingClientRect()
    const container = handle.parentElement!.getBoundingClientRect()
    const [start, end, available] = axis === 'x' ? [panel.left, panel.right, container.width] : [panel.top, panel.bottom, container.height]
    const wanted = pointer === null ? end - start + change : target === 'previous' ? pointer - start - GAP / 2 : end - pointer - GAP / 2
    return Math.round(Math.min(Math.max(wanted, min), Math.max(min, available * maxShare)))
  }

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) onChange(sizeFor(event.currentTarget, axis === 'x' ? event.clientX : event.clientY))
  }

  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const [back, forward] = axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
    const along = event.key === forward ? 1 : event.key === back ? -1 : 0
    if (along === 0) return
    event.preventDefault()
    // Moving the handle away from the panel it resizes makes that panel larger.
    onChange(sizeFor(event.currentTarget, null, (target === 'previous' ? along : -along) * KEY_STEP))
  }

  return (
    <div
      className={`panel-resizer ${axis}${dragging ? ' dragging' : ''}`}
      style={{ gridColumn: tracks(column), gridRow: tracks(row) }}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={`Size of ${label}`}
      aria-valuenow={size ?? undefined}
      tabIndex={0}
      title={`Drag to resize ${label}; double-click to reset`}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={drag}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => onChange(null)}
      onKeyDown={key}
    />
  )
}
