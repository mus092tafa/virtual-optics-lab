/**
 * Drawings of the laboratory hardware for the side view of the bench.
 * Each glyph is drawn around the origin: x = 0 is the component's optical
 * plane, y = 0 the optical axis. `yScale` is pixels per metre vertically.
 */
import { SCREEN_HALF_SIZE } from '../../physics/constants'
import type { BenchComponent } from '../../physics/types'
import { cssRgb } from '../hooks'
import { SLIT_PLATE_HALF_HEIGHT } from './glyphMetrics'

interface GlyphProps<K extends BenchComponent['kind']> {
  component: Extract<BenchComponent, { kind: K }>
  yScale: number
}

export function LaserSource({ beamColor }: { beamColor: string }) {
  return (
    <g>
      <rect x={-96} y={-15} width={90} height={30} rx={4} className="hw-body" />
      <rect x={-96} y={-15} width={90} height={7} rx={3} className="hw-highlight" />
      <rect x={-8} y={-9} width={8} height={18} rx={1.5} className="hw-metal" />
      <rect x={-84} y={15} width={10} height={5} className="hw-metal" />
      <rect x={-28} y={15} width={10} height={5} className="hw-metal" />
      <circle cx={0} cy={0} r={2.2} fill={beamColor} />
      <text x={-51} y={5} textAnchor="middle" className="hw-label">
        He-Ne
      </text>
      <circle cx={-88} cy={-3} r={2} fill={beamColor} opacity={0.9} />
    </g>
  )
}

export function TungstenSource({ component, yScale }: GlyphProps<'tungsten'>) {
  const opening = Math.max(2, (component.sourceSize / 2) * yScale)
  const glow = cssRgb([1, 0.62, 0.3], 0.25 + 0.75 * component.intensity)
  return (
    <g>
      <rect x={-56} y={-30} width={56} height={60} rx={5} className="hw-body" />
      <rect x={-56} y={-30} width={56} height={8} rx={4} className="hw-highlight" />
      {[-44, -36, -28].map((x) => (
        <line key={x} x1={x} x2={x} y1={-22} y2={-12} className="hw-vent" />
      ))}
      <circle cx={-24} cy={2} r={11} fill={glow} opacity={0.35} />
      <circle cx={-24} cy={2} r={6.5} fill={glow} />
      <path d="M -28 2 q 2 -5 4 0 q 2 5 4 0" className="hw-filament" />
      <rect x={-5} y={-opening} width={5} height={2 * opening} fill={glow} />
    </g>
  )
}

export function Lens({ component, yScale }: GlyphProps<'lens'>) {
  const half = (component.aperture / 2) * yScale
  // Stronger lenses are drawn with more curvature.
  const bulge = Math.min(15, 4 + 0.45 / component.focalLength)
  const path = `M 0 ${-half} Q ${bulge * 2} 0 0 ${half} Q ${-bulge * 2} 0 0 ${-half} Z`
  return (
    <g>
      <rect x={-6} y={-half - 7} width={12} height={7} rx={2} className="hw-metal" />
      <rect x={-6} y={half} width={12} height={7} rx={2} className="hw-metal" />
      <path d={path} className="hw-glass" />
      <line x1={0} x2={0} y1={-half} y2={half} className="hw-lens-plane" />
    </g>
  )
}

export function Slit({ double, yScale }: { double: boolean; yScale: number }) {
  const half = SLIT_PLATE_HALF_HEIGHT * yScale
  // The opening is drawn symbolically; real slit widths are far below one pixel.
  const gaps = double ? [-5, 5] : [0]
  const edges = [-half, ...gaps.flatMap((g) => [g - 2, g + 2]), half]
  const plates = []
  for (let i = 0; i < edges.length; i += 2) {
    plates.push(<rect key={i} x={-2.5} y={edges[i]} width={5} height={edges[i + 1] - edges[i]} className="hw-plate" />)
  }
  return (
    <g>
      <rect x={-5} y={-half - 4} width={10} height={2 * half + 8} rx={2} className="hw-frame" />
      {plates}
    </g>
  )
}

export function ObjectTarget({ component, yScale }: GlyphProps<'object'>) {
  const height = Math.max(6, component.height * yScale)
  const head = Math.min(9, height * 0.4)
  return (
    <g>
      <rect x={-4} y={-2} width={8} height={10} rx={1.5} className="hw-metal" />
      <line x1={0} x2={0} y1={0} y2={-height + head * 0.6} className="hw-object-shaft" />
      <path d={`M 0 ${-height} L ${head * 0.6} ${-height + head} L ${-head * 0.6} ${-height + head} Z`} className="hw-object-head" />
    </g>
  )
}

export function Screen({ yScale }: { yScale: number }) {
  const half = SCREEN_HALF_SIZE * yScale
  return (
    <g>
      <rect x={0} y={-half - 3} width={7} height={2 * half + 6} rx={1.5} className="hw-screen-back" />
      <rect x={-2} y={-half} width={4} height={2 * half} className="hw-screen-face" />
    </g>
  )
}
