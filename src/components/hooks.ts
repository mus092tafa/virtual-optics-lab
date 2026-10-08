import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

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

export function cssRgb(rgb: readonly number[], alpha = 1): string {
  const channel = (value: number) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, value)), 1 / 2.2))
  return `rgba(${channel(rgb[0])}, ${channel(rgb[1])}, ${channel(rgb[2])}, ${alpha})`
}
