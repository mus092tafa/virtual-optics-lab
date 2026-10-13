import { useRef } from 'react'
import { EYE, EYE_ANATOMY } from '../../physics/constants'
import { NORMAL_AXIAL_LENGTH, lensEdgeHeight, surfaceSag } from '../../physics/eye'
import type { EyeSetup, EyeView, RayPoint } from '../../physics/eye'
import { formatLength, formatNumber, mm } from '../../physics/units'
import { useElementSize } from '../hooks'

interface Props {
  setup: EyeSetup
  view: EyeView
  /** Draw what happens to the light inside the eye. Off while the calculated results are withheld. */
  showLight: boolean
  /**
   * An unknown eye: its length and its cornea must not be readable off the drawing, so the eyeball is drawn with the
   * standard dimensions and labelled as not to scale.
   */
  unknown: boolean
}

/** The part of the axis that is drawn, from in front of the glasses to behind the retina. */
const X_MIN = -mm(30)
const X_MAX = mm(33)
const HALF_HEIGHT = mm(13.6)
const SAMPLES = 24

/** Side view of the schematic eye. Every surface, the pupil, the retina and the rays come from the eye solver. */
export function EyeScene({ setup: actual, view, showLight, unknown }: Props) {
  const setup = unknown ? { ...actual, axialLength: NORMAL_AXIAL_LENGTH, cornealRadius: EYE.cornealRadius } : actual
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  if (width === 0 || height === 0) return <div className="surface-scene eye-scene" ref={containerRef} />

  // One scale for both directions: the eye is drawn in its true proportions.
  const scale = Math.min(width / (X_MAX - X_MIN), height / (2 * HALF_HEIGHT))
  const originX = width / 2 - ((X_MIN + X_MAX) / 2) * scale
  const px = (x: number) => originX + x * scale
  const py = (y: number) => height / 2 - y * scale
  // The incoming light is drawn from the left edge of the panel, wherever that falls on the axis.
  const xLeft = -originX / scale
  const path = (points: RayPoint[], close = false) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)},${py(p.y).toFixed(2)}`).join(' ') + (close ? ' Z' : '')
  const heights = (limit: number) => Array.from({ length: SAMPLES + 1 }, (_, i) => -limit + (2 * limit * i) / SAMPLES)

  const { lens, glasses } = view
  const { corneaHalfHeight, globeHalfHeight, glassesHalfHeight } = EYE_ANATOMY
  const lensFront = lens.chamberDepth
  const lensBack = lens.chamberDepth + lens.thickness
  const edge = lensEdgeHeight(lens)

  // Surfaces of the model, drawn from their radii.
  const cornea = heights(corneaHalfHeight).map((y) => ({ x: surfaceSag(setup.cornealRadius, y), y }))
  const lensOutline = [
    ...heights(edge).map((y) => ({ x: lensFront + surfaceSag(lens.frontRadius, y), y })),
    ...heights(edge)
      .reverse()
      .map((y) => ({ x: lensBack - surfaceSag(lens.backRadius, y), y })),
  ]

  // The eyeball is anatomy: an ellipse from the edge of the cornea to the retina, which lies at the model's axial length.
  const limbus = surfaceSag(setup.cornealRadius, corneaHalfHeight)
  const reach = Math.sqrt(1 - (corneaHalfHeight / globeHalfHeight) ** 2)
  const semiAxis = (setup.axialLength - limbus) / (1 + reach)
  const centre = setup.axialLength - semiAxis
  const start = Math.atan2(corneaHalfHeight / globeHalfHeight, -reach)
  const globe = Array.from({ length: 2 * SAMPLES + 1 }, (_, i) => {
    const angle = start - (2 * start * i) / (2 * SAMPLES)
    return { x: centre + semiAxis * Math.cos(angle), y: globeHalfHeight * Math.sin(angle) }
  })
  const retina = globe.filter((p) => p.x > centre + 0.25 * semiAxis)

  // Rays are bent where they meet the drawn surfaces; their heights are the solver's.
  const surfaceX = [
    ...(glasses ? [(p: RayPoint) => p.x] : []),
    (p: RayPoint) => surfaceSag(setup.cornealRadius, p.y),
    (p: RayPoint) => lensFront + surfaceSag(lens.frontRadius, p.y),
    (p: RayPoint) => lensBack - surfaceSag(lens.backRadius, p.y),
  ]
  const corneaIndex = glasses ? 2 : 1
  const rays = view.rays.map((ray) => {
    const first = ray[0]
    const second = ray[1]
    const slope = (second.y - first.y) / (second.x - first.x)
    const entering = [{ x: xLeft, y: first.y + slope * (xLeft - first.x) }, ...ray.slice(1, corneaIndex + 1).map((p, i) => ({ x: surfaceX[i](p), y: p.y }))]
    const inside = ray.slice(corneaIndex, -1).map((p, i) => ({ x: surfaceX[corneaIndex - 1 + i](p), y: p.y }))
    const last = inside[inside.length - 1]
    const end = ray[ray.length - 1]
    const along = (x: number) => ({ x, y: last.y + ((end.y - last.y) * (x - last.x)) / (end.x - last.x) })
    return { entering, toRetina: [...inside, along(setup.axialLength)], beyond: end.x > setup.axialLength + 1e-9 ? [along(setup.axialLength), end] : null }
  })
  const focus = view.focusDistance
  const blurTop = view.blurDiameter / 2
  const pupil = setup.pupilDiameter / 2
  const bulge = glasses ? Math.sign(glasses.power) * mm(0.5 + 0.12 * Math.abs(glasses.power)) : 0

  return (
    <div className="surface-scene eye-scene" ref={containerRef}>
      <svg width={width} height={height} role="img" aria-label="Side view of the eye with the rays from the object">
        <line x1={0} x2={width} y1={py(0)} y2={py(0)} className="eye-axis" />

        <path d={path(globe)} className="eye-globe" />
        <path d={path(retina)} className="eye-retina" />
        <path d={path(cornea)} className="eye-cornea" />

        {/* Ciliary muscle and zonule: anatomy only. They follow the lens but carry no calculation. */}
        {[1, -1].map((side) => {
          const anchor = { x: lensFront + lens.thickness / 2, y: side * (globeHalfHeight - mm(3.2)) }
          const rim = { x: lensFront + surfaceSag(lens.frontRadius, edge), y: side * edge }
          return (
            <g key={side} className="eye-anatomy">
              <line x1={px(rim.x)} y1={py(rim.y)} x2={px(anchor.x)} y2={py(anchor.y)} />
              <ellipse cx={px(anchor.x)} cy={py(anchor.y + side * mm(0.7))} rx={mm(1.1) * scale} ry={mm(0.9 + 0.25 * Math.min(2, view.lensState)) * scale} />
            </g>
          )
        })}

        {[1, -1].map((side) => (
          <line key={side} x1={px(lensFront)} x2={px(lensFront)} y1={py(side * pupil)} y2={py(side * corneaHalfHeight)} className="eye-iris" />
        ))}
        <path d={path(lensOutline, true)} className="eye-lens" />

        {glasses && (
          <path
            d={path(
              [
                ...heights(glassesHalfHeight).map((y) => ({ x: -glasses.vertexDistance - mm(0.35) - bulge * (1 - (y / glassesHalfHeight) ** 2), y })),
                ...heights(glassesHalfHeight)
                  .reverse()
                  .map((y) => ({ x: -glasses.vertexDistance + mm(0.35) + bulge * (1 - (y / glassesHalfHeight) ** 2), y })),
              ],
              true,
            )}
            className="eye-glasses"
          />
        )}

        {rays.map((ray, index) => (
          <g key={index} className={`eye-ray${index === 1 ? ' axial' : ''}`}>
            <path d={path(ray.entering)} />
            {showLight && <path d={path(ray.toRetina)} />}
            {showLight && ray.beyond && <path d={path(ray.beyond)} className="beyond" />}
          </g>
        ))}

        {showLight && view.blurDiameter > 0 && (
          <line x1={px(setup.axialLength)} x2={px(setup.axialLength)} y1={py(blurTop)} y2={py(-blurTop)} className="eye-blur" />
        )}
        {showLight && focus !== null && focus < X_MAX && (
          <g>
            <circle cx={px(focus)} cy={py(0)} r={3.5} className="eye-focus" />
            <text x={px(focus)} y={py(0) + 18} className="scene-label" textAnchor="middle">
              focus
            </text>
          </g>
        )}
        {showLight && focus !== null && focus >= X_MAX && (
          <text x={width - 8} y={py(0) + 18} className="scene-label" textAnchor="end">
            focus {formatLength(focus - setup.axialLength, 'mm', 1)} behind the retina →
          </text>
        )}

        <text x={px(surfaceSag(setup.cornealRadius, corneaHalfHeight))} y={py(corneaHalfHeight) - 8} className="scene-label" textAnchor="middle">
          cornea
        </text>
        <text x={px(lensFront + lens.thickness / 2)} y={py(-edge) + 16} className="scene-label" textAnchor="middle">
          lens
        </text>
        <text x={px(lensFront) - 7} y={py(-corneaHalfHeight) + 4} className="scene-label" textAnchor="end">
          iris and pupil
        </text>
        <text x={px(setup.axialLength) + 8} y={py(globeHalfHeight * 0.55)} className="scene-label">
          retina
        </text>
        {unknown && (
          <text x={px(setup.axialLength) + 8} y={py(0) + 34} className="scene-label faint">
            unknown eye: length and cornea
            <tspan x={px(setup.axialLength) + 8} dy={14}>
              are not drawn to scale
            </tspan>
          </text>
        )}
        <text x={px(lensFront + lens.thickness / 2)} y={py(globeHalfHeight - mm(1.2)) - 6} className="scene-label faint" textAnchor="middle">
          ciliary muscle (anatomy)
        </text>
        {glasses && (
          <text x={px(-glasses.vertexDistance)} y={py(glassesHalfHeight) - 8} className="scene-label" textAnchor="middle">
            {glasses.power === 0 ? 'plain lens' : glasses.power < 0 ? 'diverging (concave) lens' : 'converging (convex) lens'} {glasses.power > 0 ? '+' : glasses.power < 0 ? '−' : ''}
            {formatNumber(Math.abs(glasses.power), 2)} D
          </text>
        )}

        <text x={10} y={py(0) - 8} className="scene-label">
          {Number.isFinite(setup.objectDistance) ? `← object ${formatLength(setup.objectDistance, 'cm', 1)} from the cornea (not drawn)` : '← distant object (parallel light)'}
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
