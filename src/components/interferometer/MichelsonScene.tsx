import { useRef } from 'react'
import { MICHELSON_LASER_TO_LENS, MICHELSON_LENS_TO_SPLITTER } from '../../physics/constants'
import type { MichelsonSolution } from '../../physics/michelson'
import { formatLength } from '../../physics/units'
import type { InterferometerState } from '../../state/labState'
import { TILT_RANGE } from '../../state/labState'
import { useElementSize } from '../hooks'

interface Props {
  setup: InterferometerState
  solution: MichelsonSolution
  beamColor: string
  laserLabel: string
}

interface Point {
  x: number
  y: number
}

/** Top view of the interferometer, drawn to scale (beam widths included). */
export function MichelsonScene({ setup, solution, beamColor, laserLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  const toSplitter = MICHELSON_LASER_TO_LENS + MICHELSON_LENS_TO_SPLITTER
  const arm1 = setup.armLength
  const arm2 = setup.armLength + setup.coarse + setup.fine
  const toScreen = setup.splitterToScreen

  // Physical (metres, splitter at the origin, y up) -> pixels.
  const marginLeft = 118
  const marginRight = 96
  const scale = Math.max(
    100,
    Math.min((width - marginLeft - marginRight) / (toSplitter + arm1 + 0.012), (height - 96) / (arm1 + toScreen)),
  )
  const originX = marginLeft + toSplitter * scale + Math.max(0, (width - marginLeft - marginRight - (toSplitter + arm1 + 0.012) * scale) / 2)
  const originY = 52 + arm1 * scale + Math.max(0, (height - 96 - (arm1 + toScreen) * scale) / 2)
  const px = (p: Point) => ({ x: originX + p.x * scale, y: originY - p.y * scale })

  /** Envelope (1/e² radius) of the beam travelling from `from` to `to`, starting at path length z0. */
  const envelope = (from: Point, to: Point, z0: number) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const a = px(from)
    const b = px(to)
    const lengthPx = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / lengthPx
    const ny = (b.x - a.x) / lengthPx
    const upper: string[] = []
    const lower: string[] = []
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const half = Math.max(0.9, solution.beamRadiusAt(z0 + t * length) * scale)
      const cx = a.x + (b.x - a.x) * t
      const cy = a.y + (b.y - a.y) * t
      upper.push(`${(cx + nx * half).toFixed(1)},${(cy + ny * half).toFixed(1)}`)
      lower.unshift(`${(cx - nx * half).toFixed(1)},${(cy - ny * half).toFixed(1)}`)
    }
    return [...upper, ...lower].join(' ')
  }

  const splitter: Point = { x: 0, y: 0 }
  const laser: Point = { x: -toSplitter, y: 0 }
  const mirror1: Point = { x: 0, y: arm1 }
  const mirror2: Point = { x: arm2, y: 0 }
  const screen: Point = { x: 0, y: -toScreen }
  const beams = [
    { points: envelope(laser, splitter, 0), opacity: 0.55 },
    { points: envelope(splitter, mirror1, toSplitter), opacity: 0.3 },
    { points: envelope(mirror1, splitter, toSplitter + arm1), opacity: 0.3 },
    { points: envelope(splitter, mirror2, toSplitter), opacity: 0.3 },
    { points: envelope(mirror2, splitter, toSplitter + arm2), opacity: 0.3 },
    { points: envelope(splitter, screen, toSplitter + 2 * arm1), opacity: 0.3 },
    { points: envelope(splitter, screen, toSplitter + 2 * arm2), opacity: 0.3 },
  ]

  const o = px(splitter)
  const l = px(laser)
  const m1 = px(mirror1)
  const m2 = px(mirror2)
  const sc = px(screen)
  const lensX = originX - MICHELSON_LENS_TO_SPLITTER * scale
  const mirrorHalf = Math.max(22, 0.022 * scale)
  // The tilt is far too small to see; it is drawn exaggerated and labelled as such.
  const tiltDrawn = (setup.tiltX / TILT_RANGE) * 9
  const cube = Math.max(14, 0.014 * scale)

  return (
    <div className="michelson-scene" ref={containerRef}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} role="img" aria-label="Top view of the Michelson interferometer">
          <defs>
            <pattern id="mirror-back" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} x2={0} y1={0} y2={6} stroke="#56606c" strokeWidth={1.3} />
            </pattern>
          </defs>

          {/* Breadboard */}
          <rect x={12} y={12} width={width - 24} height={height - 24} rx={8} className="breadboard" />

          {beams.map((beam, index) => (
            <polygon key={index} points={beam.points} fill={beamColor} opacity={beam.opacity} />
          ))}

          {/* Laser */}
          <g transform={`translate(${l.x}, ${l.y})`}>
            <rect x={-92} y={-15} width={88} height={30} rx={4} className="hw-body" />
            <rect x={-92} y={-15} width={88} height={7} rx={3} className="hw-highlight" />
            <rect x={-6} y={-8} width={6} height={16} rx={1.5} className="hw-metal" />
            <text x={-48} y={5} textAnchor="middle" className="hw-label">
              He-Ne
            </text>
            <text x={-48} y={-22} textAnchor="middle" className="scene-label">
              {laserLabel}
            </text>
          </g>

          {/* Beam expander */}
          {setup.expanderFocalLength !== null && (
            <g transform={`translate(${lensX}, ${o.y})`}>
              <path d="M 0 -20 Q 12 0 0 20 Q -12 0 0 -20 Z" className="hw-glass" />
              <text y={-27} textAnchor="middle" className="scene-label">
                expander f = {formatLength(setup.expanderFocalLength, 'cm', 0)}
              </text>
            </g>
          )}

          {/* Beam splitter */}
          <g transform={`translate(${o.x}, ${o.y})`}>
            <rect x={-cube} y={-cube} width={2 * cube} height={2 * cube} className="splitter-cube" />
            <line x1={-cube} y1={cube} x2={cube} y2={-cube} className="splitter-coating" />
            <text x={cube + 8} y={cube + 14} className="scene-label">
              beam splitter
            </text>
          </g>

          {/* Fixed mirror M1 */}
          <g transform={`translate(${m1.x}, ${m1.y})`}>
            <rect x={-mirrorHalf} y={-9} width={2 * mirrorHalf} height={9} fill="url(#mirror-back)" />
            <line x1={-mirrorHalf} x2={mirrorHalf} y1={0} y2={0} className="mirror-line" />
            <text y={-16} textAnchor="middle" className="scene-label">
              M1 (fixed)
            </text>
          </g>

          {/* Movable mirror M2 on its translation stage */}
          <g transform={`translate(${m2.x}, ${m2.y})`}>
            <rect x={-10} y={mirrorHalf + 6} width={62} height={16} rx={3} className="stage" />
            <rect x={52} y={mirrorHalf + 9} width={22} height={10} rx={2} className="hw-metal" />
            <path d={`M 20 ${mirrorHalf + 30} h 26 m -5 -4 l 5 4 l -5 4 M 20 ${mirrorHalf + 30} l 5 -4 m -5 4 l 5 4`} className="stage-arrow" />
            <g transform={`rotate(${-tiltDrawn})`}>
              <rect x={0} y={-mirrorHalf} width={9} height={2 * mirrorHalf} fill="url(#mirror-back)" />
              <line x1={0} x2={0} y1={-mirrorHalf} y2={mirrorHalf} className="mirror-line" />
            </g>
            <text x={16} y={-mirrorHalf - 6} className="scene-label">
              M2 (movable)
            </text>
            {setup.tiltX !== 0 && (
              <text x={16} y={-mirrorHalf + 8} className="scene-note">
                tilt drawn exaggerated
              </text>
            )}
          </g>

          {/* Screen */}
          <g transform={`translate(${sc.x}, ${sc.y})`}>
            <rect x={-46} y={0} width={92} height={7} rx={1.5} className="hw-screen-back" />
            <rect x={-44} y={-2} width={88} height={4} className="hw-screen-face" />
            <text y={22} textAnchor="middle" className="scene-label">
              screen
            </text>
          </g>

          {/* Dimensions */}
          <g className="dimension">
            <line x1={o.x - mirrorHalf - 16} x2={o.x - mirrorHalf - 16} y1={o.y} y2={m1.y} />
            <text x={o.x - mirrorHalf - 22} y={(o.y + m1.y) / 2 + 4} textAnchor="end">
              L₁ = {formatLength(arm1, 'cm', 1)}
            </text>
            <line x1={o.x} x2={m2.x} y1={o.y - mirrorHalf - 12} y2={o.y - mirrorHalf - 12} />
            <text x={(o.x + m2.x) / 2} y={o.y - mirrorHalf - 18} textAnchor="middle">
              L₂ = L₁ + d
            </text>
            <line x1={o.x + 56} x2={o.x + 56} y1={o.y} y2={sc.y} />
            <text x={o.x + 62} y={(o.y + sc.y) / 2 + 4}>
              {formatLength(toScreen, 'cm', 1)}
            </text>
          </g>
        </svg>
      )}
      <div className="bench-scale">top view, to scale · {formatLength(100 / scale, 'cm', 1)} / 100 px</div>
    </div>
  )
}
