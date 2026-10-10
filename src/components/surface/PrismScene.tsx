import { useRef } from 'react'
import type { PrismSolution } from '../../physics/prism'
import type { Vec2 } from '../../physics/reflection'
import { cssRgb, useElementSize } from '../hooks'

export interface PrismRay {
  wavelength: number
  rgb: readonly number[]
  solution: PrismSolution
}

interface Props {
  rays: PrismRay[]
  showTheory: boolean
}

/** A ray (or a fan of wavelengths) refracted through a prism. Geometry comes from the prism solver. */
export function PrismScene({ rays, showTheory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  if (rays.length === 0) return <div className="surface-scene" ref={containerRef} />
  const reference = rays[Math.floor(rays.length / 2)].solution
  const [apex, left, right] = reference.vertices
  // Prism side length in pixels; the prism sits slightly below the centre.
  const scale = Math.max(80, Math.min(width, height) * 0.5)
  const cx = width / 2
  const cy = height / 2 + (apex.y * scale) / 2
  const at = (v: Vec2) => ({ x: cx + v.x * scale, y: cy - v.y * scale })
  const along = (from: Vec2, direction: Vec2, length: number): Vec2 => ({ x: from.x + direction.x * length, y: from.y + direction.y * length })
  const reach = (Math.hypot(width, height) / scale) * 0.75
  const segment = (from: Vec2, to: Vec2, color: string, key: string, opacity = 1) => {
    const a = at(from)
    const b = at(to)
    return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity={opacity} className="prism-ray" />
  }
  const normal = (point: Vec2, direction: Vec2, key: string) => {
    const a = at(along(point, direction, 0.32))
    const b = at(along(point, direction, -0.32))
    return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="normal-line" />
  }
  const entry = reference.entry
  const source = along(entry, reference.incident, -reach)

  return (
    <div className="surface-scene" ref={containerRef}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} role="img" aria-label="Ray passing through a prism">
          <polygon points={[apex, left, right].map((v) => `${at(v).x},${at(v).y}`).join(' ')} className="prism-glass" />
          {normal(entry, reference.normal1, 'n1')}
          {reference.outcome !== 'misses-second-face' && normal(reference.exit, reference.normal2, 'n2')}
          {/* Direction the light would keep without the prism: the deviation is measured from it. */}
          {(() => {
            const a = at(entry)
            const b = at(along(entry, reference.incident, reach))
            return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="prism-undeviated" />
          })()}
          {segment(source, entry, rays.length > 1 ? '#f4f4f4' : cssRgb(rays[0].rgb), 'incident')}
          {rays.map((ray, index) => {
            const s = ray.solution
            const color = cssRgb(ray.rgb)
            // Brightness follows the transmitted power (display gamma only).
            const emergentOpacity = Math.sqrt(s.transmittance)
            return (
              <g key={index}>
                {segment(s.entry, s.exit, color, 'inside')}
                {s.emergent && segment(s.exit, along(s.exit, s.emergent, reach), color, 'emergent', emergentOpacity)}
                {s.internalReflection && segment(s.exit, along(s.exit, s.internalReflection, 0.35), color, 'internal')}
              </g>
            )
          })}
          <text x={at(apex).x} y={at(apex).y - 8} textAnchor="middle" className="prism-label">
            A
          </text>
          {showTheory && reference.emergent && (
            <text x={at(along(reference.exit, reference.emergent, 0.9)).x + 8} y={at(along(reference.exit, reference.emergent, 0.9)).y - 8} className="prism-label">
              emergent
            </text>
          )}
          <text x={at(along(entry, reference.incident, 1.5)).x + 6} y={at(along(entry, reference.incident, 1.5)).y - 6} className="prism-label">
            undeviated direction
          </text>
        </svg>
      )}
    </div>
  )
}
