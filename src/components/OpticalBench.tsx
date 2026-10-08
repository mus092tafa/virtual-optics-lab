import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { RAIL_LENGTH } from '../physics/constants'
import type { Segment } from '../physics/lenses'
import type { BenchSolution } from '../physics/optics'
import type { BenchComponent } from '../physics/types'
import { cm, formatLength, fromMeters, mm } from '../physics/units'
import { actions, theoryVisible, useLab } from '../state/labState'
import { BEAM_ZOOM_FACTOR, SLIT_PLATE_HALF_HEIGHT, glyphBodyLeft, glyphTop } from './bench/glyphMetrics'
import { LaserSource, Lens, ObjectTarget, Screen, Slit, TungstenSource } from './bench/glyphs'
import { cssRgb, useElementSize } from './hooks'
import { componentCaption } from './labels'

/** Half of the vertical range shown above and below the optical axis. */
const VERTICAL_HALF_RANGE = mm(74)
const RAIL_HEIGHT = 30
const RAY_COLORS = { parallel: '#ff7b72', central: '#56d364', focal: '#58a6ff' } as const

interface Measurement {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Props {
  solution: BenchSolution
}

export function OpticalBench({ solution }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useElementSize(containerRef)
  const components = useLab((s) => s.components)
  const selectedId = useLab((s) => s.selectedId)
  const view = useLab((s) => s.view)
  const showRays = useLab((s) => s.showRays)
  const rulerTool = useLab((s) => s.rulerTool)
  const beamZoom = useLab((s) => s.beamZoom)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [measurement, setMeasurement] = useState<Measurement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragRef = useRef<
    | { type: 'component'; id: string; offset: number }
    | { type: 'pan'; startClientX: number; x0: number; x1: number }
    | { type: 'measure' }
    | null
  >(null)

  // --- Physical <-> pixel mapping. Zoom changes only these functions. ----------
  const railTop = height - 86
  const axisY = Math.max(60, railTop / 2 + 4)
  const yScale = Math.max(200, (axisY - 26) / VERTICAL_HALF_RANGE)
  const span = view.x1 - view.x0
  const xScale = width / span
  const toPx = useCallback((x: number) => (x - view.x0) * xScale, [view.x0, xScale])
  const toPy = useCallback((y: number) => axisY - y * yScale, [axisY, yScale])
  const fromClient = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current!.getBoundingClientRect()
      return { x: view.x0 + (clientX - rect.left) / xScale, y: (axisY - (clientY - rect.top)) / yScale }
    },
    [view.x0, xScale, axisY, yScale],
  )

  // Wheel zoom about the cursor (needs a non-passive listener to stop page scroll).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const fraction = (event.clientX - rect.left) / rect.width
      const anchor = view.x0 + fraction * (view.x1 - view.x0)
      const factor = Math.exp(event.deltaY * 0.0015)
      const nextSpan = (view.x1 - view.x0) * factor
      actions.setView({ x0: anchor - fraction * nextSpan, x1: anchor + (1 - fraction) * nextSpan })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [view])

  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (rulerTool) {
      const p = fromClient(event.clientX, event.clientY)
      dragRef.current = { type: 'measure' }
      setMeasurement({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    } else {
      dragRef.current = { type: 'pan', startClientX: event.clientX, x0: view.x0, x1: view.x1 }
      actions.select(null)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const p = fromClient(event.clientX, event.clientY)
    setCursor(p)
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'component') {
      actions.moveComponent(drag.id, p.x - drag.offset)
    } else if (drag.type === 'pan') {
      const shift = (event.clientX - drag.startClientX) / xScale
      actions.setView({ x0: drag.x0 - shift, x1: drag.x1 - shift })
    } else {
      setMeasurement((m) => (m ? { ...m, x1: p.x, y1: p.y } : m))
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setDraggingId(null)
  }

  const onComponentDown = (event: ReactPointerEvent<SVGGElement>, component: BenchComponent) => {
    if (event.button !== 0 || rulerTool) return
    event.stopPropagation()
    svgRef.current!.setPointerCapture(event.pointerId)
    const p = fromClient(event.clientX, event.clientY)
    dragRef.current = { type: 'component', id: component.id, offset: p.x - component.x }
    setDraggingId(component.id)
    actions.select(component.id)
  }

  const onComponentKey = (event: ReactKeyboardEvent<SVGGElement>, component: BenchComponent) => {
    const step = event.shiftKey ? cm(1) : mm(1)
    if (event.key === 'ArrowLeft') actions.moveComponent(component.id, component.x - step)
    else if (event.key === 'ArrowRight') actions.moveComponent(component.id, component.x + step)
    else if (event.key === 'Delete' || event.key === 'Backspace') actions.removeComponent(component.id)
    else if (event.key === 'Enter' || event.key === ' ') actions.select(component.id)
    else return
    event.preventDefault()
  }

  const sorted = useMemo(() => [...components].sort((a, b) => a.x - b.x), [components])
  const ticks = useMemo(() => railTicks(view.x0, view.x1, xScale), [view.x0, view.x1, xScale])
  const { overlay } = solution
  const light = cssRgb(overlay.lightRgb)
  const power = solution.source?.kind === 'tungsten' ? solution.source.intensity : 1
  const ready = width > 0 && height > 0
  // The exaggerated beam shows where the waist is, which the student must find in experiment mode.
  const beamScale = yScale * (beamZoom && showTheory ? BEAM_ZOOM_FACTOR : 1)

  const polygon = (points: { x: number; y: number }[]) => points.map((p) => `${toPx(p.x).toFixed(1)},${toPy(p.y).toFixed(1)}`).join(' ')
  const line = (segment: Segment, key: string, className: string, color: string) => (
    <line
      key={key}
      x1={toPx(segment.from.x)}
      y1={toPy(segment.from.y)}
      x2={toPx(segment.to.x)}
      y2={toPy(segment.to.y)}
      stroke={color}
      className={className}
    />
  )

  // In experiment mode the light past the first lens is not drawn: where it
  // converges is exactly what the student has to find with the screen.
  const bundle = overlay.bundle
    ? showTheory
      ? overlay.bundle
      : { upper: overlay.bundle.upper.slice(0, 2), lower: overlay.bundle.lower.slice(0, 2) }
    : null

  return (
    <div className="bench" ref={containerRef}>
      {ready && (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className={`bench-svg${rulerTool ? ' measuring' : ''}`}
          onPointerDown={onBackgroundDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => setCursor(null)}
          role="application"
          aria-label="Optical bench, side view. Drag components along the rail."
        >
          <defs>
            <clipPath id="bench-light-clip">
              <rect x={0} y={0} width={width} height={railTop - 4} />
            </clipPath>
            <linearGradient id="rail-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#5d6875" />
              <stop offset="0.18" stopColor="#3a434e" />
              <stop offset="1" stopColor="#1d232b" />
            </linearGradient>
          </defs>

          {/* Optical rail with its scale */}
          <g>
            <rect
              x={toPx(0) - 10}
              y={railTop}
              width={RAIL_LENGTH * xScale + 20}
              height={RAIL_HEIGHT}
              rx={3}
              fill="url(#rail-gradient)"
              className="rail"
            />
            <rect x={toPx(0) - 10} y={railTop + RAIL_HEIGHT} width={RAIL_LENGTH * xScale + 20} height={5} className="rail-foot" />
            {ticks.map((tick) => (
              <g key={tick.x}>
                <line x1={toPx(tick.x)} x2={toPx(tick.x)} y1={railTop + RAIL_HEIGHT - tick.size} y2={railTop + RAIL_HEIGHT} className="rail-tick" />
                {tick.label && (
                  <text x={toPx(tick.x)} y={railTop + RAIL_HEIGHT + 14} textAnchor="middle" className="rail-number">
                    {tick.label}
                  </text>
                )}
              </g>
            ))}
            <text x={Math.min(width - 6, toPx(RAIL_LENGTH) + 14)} y={railTop + RAIL_HEIGHT + 14} textAnchor="end" className="rail-unit">
              cm
            </text>
          </g>

          {/* Posts and carriers */}
          {sorted.map((component) => (
            <g key={`post-${component.id}`} transform={`translate(${toPx(component.x)}, 0)`}>
              <rect x={-2.5} y={axisY} width={5} height={railTop - axisY} className="post" />
              <rect x={-13} y={railTop - 9} width={26} height={17} rx={2.5} className="carrier" />
              <circle cx={9} cy={railTop + 1} r={2.4} className="carrier-knob" />
              <line x1={0} x2={0} y1={railTop + 8} y2={railTop + RAIL_HEIGHT} className="carrier-index" />
            </g>
          ))}

          <line x1={0} x2={width} y1={axisY} y2={axisY} className="optical-axis" />
          <text x={width - 8} y={axisY - 6} textAnchor="end" className="axis-label">
            optical axis
          </text>

          {/* Light */}
          <g clipPath="url(#bench-light-clip)" style={{ pointerEvents: 'none' }}>
            {overlay.lampCone && (
              <polygon
                points={polygon([
                  { x: overlay.lampCone.x0, y: overlay.lampCone.halfHeight0 },
                  { x: overlay.lampCone.x1, y: overlay.lampCone.halfHeight1 },
                  { x: overlay.lampCone.x1, y: -overlay.lampCone.halfHeight1 },
                  { x: overlay.lampCone.x0, y: -overlay.lampCone.halfHeight0 },
                ])}
                fill={light}
                opacity={0.05 + 0.2 * power}
              />
            )}
            {bundle && (
              <polygon points={polygon([...bundle.upper, ...[...bundle.lower].reverse()])} fill={light} opacity={0.06 + 0.2 * power} />
            )}
            {overlay.fan && overlay.fan.inViewPlane && (
              <polygon
                points={polygon([
                  { x: overlay.fan.x, y: 0 },
                  { x: overlay.fan.xEnd, y: Math.tan(overlay.fan.halfAngle) * (overlay.fan.xEnd - overlay.fan.x) },
                  { x: overlay.fan.xEnd, y: -Math.tan(overlay.fan.halfAngle) * (overlay.fan.xEnd - overlay.fan.x) },
                ])}
                fill={light}
                opacity={0.28}
              />
            )}
            {overlay.fan && !overlay.fan.inViewPlane && !overlay.beam && (
              <line x1={toPx(overlay.fan.x)} x2={toPx(overlay.fan.xEnd)} y1={axisY} y2={axisY} stroke={light} strokeWidth={2} opacity={0.6} />
            )}
            {overlay.beam && (
              <>
                <polygon points={beamPolygon(overlay.beam, toPx, axisY, beamScale, 3.5)} fill={light} opacity={0.22} />
                <polygon points={beamPolygon(overlay.beam, toPx, axisY, beamScale, 0.9)} fill={light} />
              </>
            )}
          </g>

          {/* Focal points */}
          {sorted.map((component) =>
            component.kind === 'lens' && (showTheory || !component.concealed)
              ? [-1, 1].map((side) => {
                  const fx = toPx(component.x + side * component.focalLength)
                  return (
                    <g key={`${component.id}-f${side}`} className="focal-mark">
                      <line x1={fx} x2={fx} y1={axisY - 4} y2={axisY + 4} />
                      <text x={fx} y={axisY + 16} textAnchor="middle">
                        {side < 0 ? 'F' : 'F′'}
                      </text>
                    </g>
                  )
                })
              : null,
          )}

          {/* Principal rays and calculated images (theory) */}
          {showTheory && (
            <g clipPath="url(#bench-light-clip)" style={{ pointerEvents: 'none' }}>
              {showRays &&
                overlay.principalRays.map((ray, index) => {
                  const color = RAY_COLORS[ray.kind]
                  return (
                    <g key={index}>
                      {line(ray.incoming, 'in', 'ray', color)}
                      {line(ray.outgoing, 'out', 'ray', color)}
                      {ray.virtualExtension && line(ray.virtualExtension, 'virtual', 'ray ray-virtual', color)}
                      {ray.incomingExtension && line(ray.incomingExtension, 'extension', 'ray ray-virtual', color)}
                    </g>
                  )
                })}
              {overlay.images.map((image, index) => {
                const x = toPx(image.x)
                const tip = toPy(image.height)
                const direction = image.height >= 0 ? 1 : -1
                const head = Math.min(8, Math.abs(tip - axisY) * 0.4)
                return (
                  <g key={index} className={`image-marker${image.isReal ? '' : ' virtual'}${image.isFinal ? ' final' : ''}`}>
                    <line x1={x} x2={x} y1={axisY} y2={tip + direction * head * 0.6} />
                    <path d={`M ${x} ${tip} L ${x + head * 0.6} ${tip + direction * head} L ${x - head * 0.6} ${tip + direction * head} Z`} />
                    <text x={x + 8} y={tip + (direction > 0 ? -2 : 12)}>
                      {image.isReal ? 'image' : 'virtual image'}
                    </text>
                  </g>
                )
              })}
            </g>
          )}

          {/* Components */}
          {sorted.map((component) => {
            const top = glyphTop(component, yScale)
            const left = glyphBodyLeft(component)
            const selected = component.id === selectedId
            return (
              <g
                key={component.id}
                transform={`translate(${toPx(component.x)}, ${axisY})`}
                className={`component${selected ? ' selected' : ''}${draggingId === component.id ? ' dragging' : ''}`}
                tabIndex={0}
                role="slider"
                aria-label={`${componentCaption(component, showTheory)} at ${formatLength(component.x, 'cm', 1)}`}
                aria-valuemin={0}
                aria-valuemax={fromMeters(RAIL_LENGTH, 'cm')}
                aria-valuenow={Number(fromMeters(component.x, 'cm').toFixed(1))}
                onPointerDown={(event) => onComponentDown(event, component)}
                onKeyDown={(event) => onComponentKey(event, component)}
                onFocus={() => actions.select(component.id)}
              >
                <rect x={-left} y={-top - 4} width={left + 14} height={top + 4 + (railTop - axisY) + 10} className="component-hit" />
                {component.kind === 'laser' && <LaserSource beamColor={light} />}
                {component.kind === 'tungsten' && <TungstenSource component={component} yScale={yScale} />}
                {component.kind === 'lens' && <Lens component={component} yScale={yScale} />}
                {component.kind === 'singleSlit' && <Slit double={false} yScale={yScale} />}
                {component.kind === 'doubleSlit' && <Slit double yScale={yScale} />}
                {component.kind === 'object' && <ObjectTarget component={component} yScale={yScale} />}
                {component.kind === 'screen' && <Screen yScale={yScale} />}
                <text x={component.kind === 'laser' ? -48 : component.kind === 'tungsten' ? -28 : 0} y={-top - 8} textAnchor="middle" className="component-caption">
                  {componentCaption(component, showTheory)}
                </text>
                <g transform={`translate(0, ${railTop - axisY + RAIL_HEIGHT + 31})`}>
                  <rect x={-27} y={-11} width={54} height={15} rx={3} className="position-tag" />
                  <text y={0} textAnchor="middle" className="position-text">
                    {formatLength(component.x, 'cm', 1)}
                  </text>
                </g>
              </g>
            )
          })}

          {/* Distances between neighbouring components */}
          {sorted.slice(1).map((component, index) => {
            const previous = sorted[index]
            const a = toPx(previous.x)
            const b = toPx(component.x)
            if (b - a < 58) return null
            const y = railTop + RAIL_HEIGHT + 47
            return (
              <g key={`gap-${component.id}`} className="dimension">
                <line x1={a + 3} x2={b - 3} y1={y} y2={y} />
                <line x1={a} x2={a} y1={y - 4} y2={y + 4} />
                <line x1={b} x2={b} y1={y - 4} y2={y + 4} />
                <rect x={(a + b) / 2 - 27} y={y - 8} width={54} height={15} className="dimension-bg" />
                <text x={(a + b) / 2} y={y + 4} textAnchor="middle">
                  {formatLength(component.x - previous.x, 'cm', 1)}
                </text>
              </g>
            )
          })}

          {overlay.fan && !overlay.fan.inViewPlane && (
            <text x={toPx(overlay.fan.x) + 10} y={axisY + SLIT_PLATE_HALF_HEIGHT * yScale + 22} className="bench-note">
              pattern spreads ⟂ to this view
            </text>
          )}

          {/* Ruler tool */}
          {measurement && (
            <g className="measure" style={{ pointerEvents: 'none' }}>
              <line x1={toPx(measurement.x0)} y1={toPy(measurement.y0)} x2={toPx(measurement.x1)} y2={toPy(measurement.y1)} />
              <circle cx={toPx(measurement.x0)} cy={toPy(measurement.y0)} r={3} />
              <circle cx={toPx(measurement.x1)} cy={toPy(measurement.y1)} r={3} />
              <text x={(toPx(measurement.x0) + toPx(measurement.x1)) / 2} y={Math.min(toPy(measurement.y0), toPy(measurement.y1)) - 8} textAnchor="middle">
                Δx = {formatLength(Math.abs(measurement.x1 - measurement.x0), 'cm', 2)} · Δy ={' '}
                {formatLength(Math.abs(measurement.y1 - measurement.y0), 'mm', 1)}
              </text>
            </g>
          )}
        </svg>
      )}

      <div className="bench-readout" aria-live="off">
        {cursor ? (
          <>
            x = {formatLength(cursor.x, 'cm', 1)} &nbsp; y = {formatLength(cursor.y, 'mm', 1)}
          </>
        ) : (
          <>move the cursor over the bench to read coordinates</>
        )}
      </div>
      <div className="bench-scale">
        horizontal {formatLength(100 / xScale, 'cm', 1)} / 100 px · vertical {formatLength(100 / yScale, 'cm', 1)} / 100 px
      </div>
      {measurement && (
        <button className="chip bench-clear" onClick={() => setMeasurement(null)}>
          clear measurement
        </button>
      )}
    </div>
  )
}

function beamPolygon(
  samples: { x: number; w: number }[],
  toPx: (x: number) => number,
  axisY: number,
  yScale: number,
  minHalfWidth: number,
): string {
  // The beam radius is to scale; it is only kept from vanishing below one pixel.
  const half = (w: number) => Math.max(minHalfWidth, w * yScale + (minHalfWidth > 1 ? 2.5 : 0))
  const upper = samples.map((s) => `${toPx(s.x).toFixed(1)},${(axisY - half(s.w)).toFixed(1)}`)
  const lower = [...samples].reverse().map((s) => `${toPx(s.x).toFixed(1)},${(axisY + half(s.w)).toFixed(1)}`)
  return [...upper, ...lower].join(' ')
}

interface Tick {
  x: number
  size: number
  label: string | null
}

function railTicks(x0: number, x1: number, xScale: number): Tick[] {
  const pxPerCm = xScale * cm(1)
  const minorMm = pxPerCm >= 36 ? 1 : pxPerCm >= 3.5 ? 10 : 50
  const labelEveryMm = pxPerCm >= 26 ? 10 : pxPerCm >= 6.5 ? 50 : pxPerCm >= 3 ? 100 : 200
  const first = Math.max(0, Math.ceil(fromMeters(x0, 'mm') / minorMm) * minorMm)
  const last = Math.min(fromMeters(RAIL_LENGTH, 'mm'), fromMeters(x1, 'mm'))
  const ticks: Tick[] = []
  for (let value = first; value <= last + 1e-6; value += minorMm) {
    const rounded = Math.round(value)
    const size = rounded % 100 === 0 ? 13 : rounded % 50 === 0 ? 11 : rounded % 10 === 0 ? 8 : rounded % 5 === 0 ? 6 : 4
    ticks.push({ x: mm(rounded), size, label: rounded % labelEveryMm === 0 ? String(rounded / 10) : null })
  }
  return ticks
}
