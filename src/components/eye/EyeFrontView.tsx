import { useRef } from 'react'
import { EYE_ANATOMY } from '../../physics/constants'
import { cornealPower, crossRadius, isAstigmatic } from '../../physics/eye'
import type { EyeSetup } from '../../physics/eye'
import { formatAxis, formatLength, formatNumber, formatPrescription, mm } from '../../physics/units'
import { useElementSize } from '../hooks'

interface Props {
  setup: EyeSetup
  /** An unknown eye: the meridians of its cornea must not be readable off the drawing. */
  unknown: boolean
}

/** Half the width of the drawing: the spectacle lens with room for the scale of degrees. */
const HALF_SPAN = mm(15.5)
const SCALE_RADIUS = mm(11.5)
const TICKS = Array.from({ length: 36 }, (_, i) => i * 5)

/**
 * The eye seen by an examiner facing it: the pupil at its diameter, the two principal meridians of the cornea, and the
 * axis of the cylinder of the glasses, on a scale of degrees counted counter-clockwise from the horizontal.
 */
export function EyeFrontView({ setup, unknown }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  if (width === 0 || height === 0) return <div className="surface-scene eye-scene" ref={containerRef} />

  const scale = Math.min(width, height) / (2 * HALF_SPAN)
  const cx = width / 2
  const cy = height / 2
  // A point at the distance r in the direction of an angle; y runs upwards for the examiner and downwards on the page.
  const at = (r: number, angle: number) => ({ x: cx + r * scale * Math.cos(angle), y: cy - r * scale * Math.sin(angle) })
  const diameter = (r: number, angle: number) => {
    const from = at(r, angle + Math.PI)
    const to = at(r, angle)
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  }

  const { corneaHalfHeight, glassesHalfHeight } = EYE_ANATOMY
  const { glasses } = setup
  const meridian = setup.cornealMeridian ?? 0
  const astigmatic = isAstigmatic(setup) && !unknown
  const meridians = [
    { angle: meridian, radius: setup.cornealRadius },
    { angle: meridian + Math.PI / 2, radius: crossRadius(setup) },
  ]
  const cylinder = glasses?.cylinder ?? 0

  return (
    <div className="surface-scene eye-scene" ref={containerRef}>
      <svg width={width} height={height} role="img" aria-label="Front view of the eye with the meridians of the cornea and the axis of the glasses">
        {glasses && <circle cx={cx} cy={cy} r={glassesHalfHeight * scale} className="eye-glasses" />}
        <circle cx={cx} cy={cy} r={corneaHalfHeight * scale} className="eye-front-iris" />
        <circle cx={cx} cy={cy} r={(setup.pupilDiameter / 2) * scale} className="eye-front-pupil" />
        {/* A ring stop covers the middle of the pupil. */}
        {setup.realRays && (setup.pupilZone ?? 0) > 0 && <circle cx={cx} cy={cy} r={(setup.pupilDiameter / 2) * setup.pupilZone! * scale} className="eye-front-stop" />}

        {/* The scale of degrees: the upper half carries the numbers, as on a trial frame. */}
        <g className="eye-degrees">
          {TICKS.map((degrees) => {
            const angle = (degrees * Math.PI) / 180
            const long = degrees % 30 === 0
            const from = at(SCALE_RADIUS, angle)
            const to = at(SCALE_RADIUS + mm(long ? 1.1 : 0.6), angle)
            const label = at(SCALE_RADIUS + mm(2.3), angle)
            return (
              <g key={degrees}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <line {...{ x1: 2 * cx - from.x, y1: 2 * cy - from.y, x2: 2 * cx - to.x, y2: 2 * cy - to.y }} />
                {long && (
                  <text x={label.x} y={label.y + 4} textAnchor="middle" className="scene-label faint">
                    {degrees}
                  </text>
                )}
              </g>
            )
          })}
          <text {...{ x: at(SCALE_RADIUS + mm(2.3), Math.PI).x, y: cy + 4 }} textAnchor="middle" className="scene-label faint">
            180
          </text>
        </g>

        {astigmatic &&
          meridians.map((entry, index) => {
            const label = at(corneaHalfHeight + mm(0.5), entry.angle)
            return (
              <g key={index}>
                <line {...diameter(corneaHalfHeight, entry.angle)} className={`eye-meridian${index === 1 ? ' cross' : ''}`} />
                <text x={label.x + 6} y={label.y - 4} className="scene-label">
                  {formatAxis(entry.angle)}: r = {formatLength(entry.radius, 'mm', 2)}, {formatNumber(cornealPower(entry.radius), 1)} D
                </text>
              </g>
            )
          })}

        {glasses && cylinder !== 0 && (
          <g>
            <line {...diameter(glassesHalfHeight, glasses.axis ?? 0)} className="eye-cylinder-axis" />
            <text {...{ x: at(glassesHalfHeight, (glasses.axis ?? 0) + Math.PI).x, y: at(glassesHalfHeight, (glasses.axis ?? 0) + Math.PI).y + 14 }} className="scene-label" textAnchor="middle">
              cylinder axis {formatAxis(glasses.axis ?? 0)}
            </text>
          </g>
        )}

        <text x={10} y={16} className="scene-label">
          Front view — facing the eye, angles counter-clockwise from the horizontal
        </text>
        <text x={10} y={32} className="scene-label faint">
          {unknown ? 'unknown eye: the meridians of its cornea are not shown' : astigmatic ? 'two principal meridians of the cornea, at right angles' : `cornea with one radius, ${formatLength(setup.cornealRadius, 'mm', 2)}`}
        </text>
        {glasses && (
          <text x={10} y={48} className="scene-label faint">
            glasses {formatPrescription({ sphere: glasses.power, cylinder, axis: glasses.axis ?? 0 })}
          </text>
        )}
        <text x={cx} y={cy + (setup.pupilDiameter / 2) * scale + 14} className="scene-label faint" textAnchor="middle">
          pupil {formatLength(setup.pupilDiameter, 'mm', 1)}
        </text>

        <g className="eye-scale">
          <line x1={14} x2={14 + mm(5) * scale} y1={height - 14} y2={height - 14} />
          <text x={14 + (mm(5) * scale) / 2} y={height - 20} textAnchor="middle" className="scene-label">
            5 mm
          </text>
        </g>
      </svg>
    </div>
  )
}
