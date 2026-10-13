import { useEffect, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

export interface Size {
  width: number
  height: number
}

/** Tracks the rendered size of an element. */
export function useElementSize(ref: RefObject<Element | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/** How small a panel can be dragged, in pixels, and the largest share of its container it may take. */
export interface PanelLimits {
  min: number
  maxShare: number
}

/** The panels of a workspace that can be dragged to another size. Not every workspace has all of them. */
const PANELS = {
  /** The list of components on the left of the bench. */
  palette: { min: 120, maxShare: 0.25 },
  /** The column on the right: the screen, the image or the controls. */
  side: { min: 260, maxShare: 0.6 },
  /** The row of panels under the experiment. */
  bottom: { min: 120, maxShare: 0.6 },
  /** The first two panels of that row. */
  controls: { min: 180, maxShare: 0.4 },
  physics: { min: 180, maxShare: 0.4 },
  /** The upper panel of a right column that holds two. */
  upper: { min: 120, maxShare: 0.8 },
} satisfies Record<string, PanelLimits>
type PanelName = keyof typeof PANELS

const LAYOUT_KEY = 'optics-lab.layout.'
const LAYOUT_RESET = 'optics-lab:layout-reset'

/** Returns the panels of every workspace to the sizes the layout gives them. */
export function resetPanelLayouts(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(LAYOUT_KEY)) localStorage.removeItem(key)
  } catch {
    // Nothing was kept, then.
  }
  window.dispatchEvent(new Event(LAYOUT_RESET))
}

/**
 * The sizes of a workspace's panels that the student chose by dragging, kept on this computer. Each is handed to the
 * style sheet as a custom property named after the panel; a panel without one keeps the size the layout gives it.
 */
export function usePanelLayout(workspace: string) {
  const key = `${LAYOUT_KEY}${workspace}`
  const [sizes, setSizes] = useState<Partial<Record<PanelName, number>>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      return stored && typeof stored === 'object' ? (stored as Partial<Record<PanelName, number>>) : {}
    } catch {
      return {}
    }
  })
  useEffect(() => {
    const reset = () => setSizes({})
    window.addEventListener(LAYOUT_RESET, reset)
    return () => window.removeEventListener(LAYOUT_RESET, reset)
  }, [])
  const names = Object.keys(PANELS) as PanelName[]
  const style: Record<string, string> = {}
  for (const name of names) {
    const size = sizes[name]
    // The share keeps a size chosen in a large window from crowding out the neighbours in a small one.
    if (typeof size === 'number' && size > 0) style[`--${name}`] = `min(${size}px, ${PANELS[name].maxShare * 100}%)`
  }
  const handle = (name: PanelName) => ({
    ...PANELS[name],
    size: sizes[name] ?? null,
    onChange: (size: number | null) => {
      const next = { ...sizes }
      if (size === null) delete next[name]
      else next[name] = size
      setSizes(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // The sizes then last only until the page is closed.
      }
    },
  })
  return { style: style as CSSProperties, handle }
}

export function cssRgb(rgb: readonly number[], alpha = 1): string {
  const channel = (value: number) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, value)), 1 / 2.2))
  return `rgba(${channel(rgb[0])}, ${channel(rgb[1])}, ${channel(rgb[2])}, ${alpha})`
}
