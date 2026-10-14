import { useEffect, useRef } from 'react'
import type { EyeView } from '../../physics/eye'
import { renderRetinalImage } from '../../render/eyeImage'
import type { EyeChart } from '../../state/presets'
import { useElementSize } from '../hooks'

/** Most pixels along one side of the picture, whatever the size of the panel. */
const MAX_CANVAS_SIZE = 900

interface Props {
  view: EyeView
  chart: EyeChart
  fieldOfView: number
  label: string
}

/** The chart as the eye images it: its retinal size and blur come from the eye solver. */
export function RetinalImage({ view, chart, fieldOfView, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { letterScale, pointSpread, illuminance } = view
  // The picture is computed at the size it is shown, so that a larger panel is not an enlarged, softened copy.
  const { width } = useElementSize(canvasRef)
  const size = Math.min(MAX_CANVAS_SIZE, Math.round(width * window.devicePixelRatio))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size === 0) return
    // Coalesce rapid updates (dragging a slider) into one paint per frame.
    const frame = requestAnimationFrame(() => {
      if (canvas.width !== size) {
        canvas.width = size
        canvas.height = size
      }
      renderRetinalImage(canvas.getContext('2d')!, { chart, letterScale, pointSpread, illuminance, fieldOfView }, size)
    })
    return () => cancelAnimationFrame(frame)
  }, [chart, letterScale, pointSpread, illuminance, fieldOfView, size])

  return (
    <figure className="retinal-image">
      <canvas ref={canvasRef} aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}
