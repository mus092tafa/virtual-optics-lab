import { useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { material } from '../../physics/constants'
import type { Vec2 } from '../../physics/reflection'
import type { SurfaceSolution } from '../../physics/surface'
import { degToRad, radToDeg } from '../../physics/units'
import { actions } from '../../state/labState'
import type { SurfaceState } from '../../state/labState'
import { useElementSize } from '../hooks'
import { MAX_TILT } from './limits'

const BEAM = '#ff3b30'
const SNAP = degToRad(0.5)

interface Props {
  surface: SurfaceState
  solution: SurfaceSolution
  showTheory: boolean
}

/** Top view of a ray meeting a mirror or an interface, with a protractor. */
export function SurfaceScene({ surface, solution, showTheory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useElementSize(containerRef)
  const drag = useRef<'source' | 'surface' | 'protractor' | null>(null)
  const cx = width / 2
  const cy = height / 2
  const radius = Math.max(60, Math.min(width, height) * 0.44)
  const protractorRadius = radius * 0.74
  const tiltDeg = radToDeg(surface.surfaceTilt)

  // Unit vector (y up) -> pixel position.
  const at = (v: Vec2, r = radius) => ({ x: cx + v.x * r, y: cy - v.y * r })
  const polar = (angle: number): Vec2 => ({ x: Math.cos(angle), y: Math.sin(angle) })

  const pointerAngle = (event: ReactPointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return Math.atan2(cy - (event.clientY - rect.top), event.clientX - rect.left - cx)
  }
  const snap = (angle: number) => Math.round(angle / SNAP) * SNAP

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const angle = pointerAngle(event)
    if (drag.current === 'source') {
      actions.updateSurface({ sourceAngle: snap(angle) })
    } else if (drag.current === 'surface') {
      // The handle sits on the right-hand end of the surface.
      const tilt = Math.atan2(Math.sin(angle), Math.cos(angle))
      actions.updateSurface({ surfaceTilt: Math.max(-MAX_TILT, Math.min(MAX_TILT, snap(tilt))) })
    } else {
      actions.updateSurface({ protractorAngle: snap(angle) })
    }
  }
  const start = (kind: NonNullable<typeof drag.current>) => (event: ReactPointerEvent) => {
    event.stopPropagation()
    svgRef.current!.setPointerCapture(event.pointerId)
    drag.current = kind
  }

  const ticks = useMemo(() => {
    const items = []
    for (let degree = 0; degree < 360; degree++) {
      const major = degree % 10 === 0
      const mid = degree % 5 === 0
      const inner = protractorRadius - (major ? 14 : mid ? 10 : 6)
      const angle = degToRad(degree)
      // Angle measured from the protractor's zero line, drawn pointing up.
      const sin = Math.sin(angle)
      const cos = Math.cos(angle)
      items.push(
        <line key={degree} x1={sin * inner} y1={-cos * inner} x2={sin * protractorRadius} y2={-cos * protractorRadius} className={major ? 'major' : mid ? 'mid' : undefined} />,
      )
      if (major) {
        // Scale reads 0–90° on each side of the zero line, like a lab protractor.
        const reading = degree <= 90 ? degree : degree <= 180 ? 180 - degree : degree <= 270 ? degree - 180 : 360 - degree
        const r = protractorRadius - 25
        items.push(
          <text key={`t${degree}`} x={sin * r} y={-cos * r + 3.5} textAnchor="middle">
            {reading}
          </text>,
        )
      }
    }
    return items
  }, [protractorRadius])

  const source = polar(surface.sourceAngle)
  const sourcePoint = at(source)
  const origin = { x: cx, y: cy }
  const n1 = material(surface.medium1)
  const n2 = material(surface.medium2)
  const tint = (n: number) => `rgba(88, 166, 255, ${Math.min(0.42, 0.04 + 0.26 * (n - 1))})`
  const strength = (fraction: number) => Math.max(0.18, Math.sqrt(fraction))
  const arrow = (to: Vec2, fraction: number, key: string, label: string) => {
    const end = at(to)
    const mid = at(to, radius * 0.55)
    const angle = -radToDeg(Math.atan2(to.y, to.x))
    return (
      <g key={key} opacity={strength(fraction)}>
        <line x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} className="surface-ray" />
        <path d="M 7 0 L -5 -5 L -5 5 Z" transform={`translate(${mid.x}, ${mid.y}) rotate(${angle})`} fill={BEAM} />
        <text x={at(to, radius * 1.05).x} y={at(to, radius * 1.05).y + 4} textAnchor="middle" className="ray-label">
          {label}
        </text>
      </g>
    )
  }
  const handle = at(polar(surface.surfaceTilt), radius * 1.02)
  const protractorHandle = at(polar(surface.protractorAngle), protractorRadius + 12)

  return (
    <div className="surface-scene" ref={containerRef}>
      {width > 0 && height > 0 && (
        <svg ref={svgRef} width={width} height={height} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          <defs>
            <clipPath id="surface-clip">
              <circle cx={cx} cy={cy} r={radius * 1.08} />
            </clipPath>
            <pattern id="mirror-hatch" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} x2={0} y1={0} y2={7} stroke="#56606c" strokeWidth={1.4} />
            </pattern>
          </defs>

          <g clipPath="url(#surface-clip)">
            <g transform={`rotate(${-tiltDeg} ${cx} ${cy})`}>
              {surface.kind === 'interface' ? (
                <>
                  <rect x={cx - 2 * radius} y={cy - 2 * radius} width={4 * radius} height={2 * radius} fill={tint(n1.n)} />
                  <rect x={cx - 2 * radius} y={cy} width={4 * radius} height={2 * radius} fill={tint(n2.n)} />
                  <line x1={cx - 2 * radius} x2={cx + 2 * radius} y1={cy} y2={cy} className="interface-line" />
                  <text x={cx - radius * 0.98} y={cy - 12} className="medium-label">
                    {n1.name} · n₁ = {n1.n.toFixed(3)}
                  </text>
                  <text x={cx - radius * 0.98} y={cy + 22} className="medium-label">
                    {n2.name} · n₂ = {n2.n.toFixed(3)}
                  </text>
                </>
              ) : (
                <>
                  <rect x={cx - radius * 0.9} y={cy} width={radius * 1.8} height={11} fill="url(#mirror-hatch)" />
                  <line x1={cx - radius * 0.9} x2={cx + radius * 0.9} y1={cy} y2={cy} className="mirror-line" />
                </>
              )}
              {surface.showNormal && <line x1={cx} x2={cx} y1={cy - radius * 1.05} y2={cy + radius * 1.05} className="normal-line" />}
            </g>
          </g>
          {surface.showNormal && (
            <text x={at(solution.normal, radius * 0.93).x + 8} y={at(solution.normal, radius * 0.93).y} className="normal-label">
              normal
            </text>
          )}

          {surface.showProtractor && (
            <g transform={`translate(${cx}, ${cy}) rotate(${90 - radToDeg(surface.protractorAngle)})`} className="protractor">
              <circle r={protractorRadius} />
              <circle r={protractorRadius - 34} className="inner" />
              {ticks}
              <line x1={0} x2={0} y1={-protractorRadius} y2={protractorRadius} className="zero" />
              <line x1={-protractorRadius} x2={protractorRadius} y1={0} y2={0} className="zero" />
            </g>
          )}

          {/* Rays: geometry from the reflection / refraction laws, brightness from Fresnel */}
          <line x1={sourcePoint.x} y1={sourcePoint.y} x2={origin.x} y2={origin.y} className="surface-ray" />
          <path
            d="M 7 0 L -5 -5 L -5 5 Z"
            transform={`translate(${at(source, radius * 0.5).x}, ${at(source, radius * 0.5).y}) rotate(${-radToDeg(surface.sourceAngle) + 180})`}
            fill={BEAM}
          />
          {solution.reflected && arrow(solution.reflected, solution.reflectance, 'reflected', showTheory ? 'reflected' : '')}
          {solution.refracted && arrow(solution.refracted, solution.transmittance, 'refracted', showTheory ? 'refracted' : '')}
          <circle cx={cx} cy={cy} r={2.5} fill="#e6edf3" />

          {/* Draggable hardware */}
          <g
            transform={`translate(${sourcePoint.x}, ${sourcePoint.y}) rotate(${-radToDeg(surface.sourceAngle)})`}
            className="ray-box"
            onPointerDown={start('source')}
            tabIndex={0}
            role="slider"
            aria-label="Ray source direction"
            aria-valuenow={Math.round(radToDeg(solution.incidentAngle))}
            onKeyDown={(event) => {
              const step = event.shiftKey ? degToRad(5) : SNAP
              if (event.key === 'ArrowLeft') actions.updateSurface({ sourceAngle: surface.sourceAngle + step })
              else if (event.key === 'ArrowRight') actions.updateSurface({ sourceAngle: surface.sourceAngle - step })
              else return
              event.preventDefault()
            }}
          >
            <rect x={-4} y={-13} width={52} height={26} rx={4} />
            <text x={22} y={4} textAnchor="middle">
              laser
            </text>
            <circle r={2.4} fill={BEAM} />
          </g>
          <g className="drag-handle" onPointerDown={start('surface')}>
            <circle cx={handle.x} cy={handle.y} r={8} />
            <title>Drag to tilt the surface</title>
          </g>
          {surface.showProtractor && (
            <g className="drag-handle protractor-handle" onPointerDown={start('protractor')}>
              <circle cx={protractorHandle.x} cy={protractorHandle.y} r={7} />
              <text x={protractorHandle.x} y={protractorHandle.y + 3.5} textAnchor="middle">
                0
              </text>
              <title>Drag to rotate the protractor</title>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
