import { useState } from 'react'
import type { PlotDefinition } from '../education/experiments'
import { MIN_FIT_POINTS } from '../education/fit'
import type { NotebookFit } from '../education/notebook'

const WIDTH = 520
const HEIGHT = 240
const MARGIN = { left: 58, right: 14, top: 12, bottom: 40 }

/** Axis range padded so that no point sits on the frame. */
function padded(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  return [min - 0.08 * span, max + 0.08 * span]
}

const tick = (value: number) => Number(value.toPrecision(3)).toString().replace('-', '−')

interface Props {
  plot: PlotDefinition
  data: NotebookFit
}

/** The recorded measurements in linearised form, with the least-squares line. */
export function NotebookPlot({ plot, data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (data.points.length === 0) return null
  const [x0, x1] = padded(data.points.map((p) => p.x))
  const [y0, y1] = padded(data.points.map((p) => p.y))
  const px = (x: number) => MARGIN.left + ((x - x0) / (x1 - x0)) * (WIDTH - MARGIN.left - MARGIN.right)
  const py = (y: number) => HEIGHT - MARGIN.bottom - ((y - y0) / (y1 - y0)) * (HEIGHT - MARGIN.top - MARGIN.bottom)
  const fractions = [0, 0.25, 0.5, 0.75, 1]
  const point = hovered !== null ? data.points[hovered] : null

  return (
    <figure className="notebook-plot">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${plot.yLabel} against ${plot.xLabel}`}>
        <defs>
          <clipPath id="notebook-plot-area">
            <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} />
          </clipPath>
        </defs>
        {fractions.map((f) => {
          const x = x0 + (x1 - x0) * f
          const y = y0 + (y1 - y0) * f
          return (
            <g key={f}>
              <line x1={px(x)} x2={px(x)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="plot-grid" />
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={py(y)} y2={py(y)} className="plot-grid" />
              <text x={px(x)} y={HEIGHT - MARGIN.bottom + 14} textAnchor="middle" className="plot-tick">
                {tick(x)}
              </text>
              <text x={MARGIN.left - 6} y={py(y) + 3.5} textAnchor="end" className="plot-tick">
                {tick(y)}
              </text>
            </g>
          )
        })}
        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 6} textAnchor="middle" className="plot-label">
          {plot.xLabel}
        </text>
        <text transform={`translate(13 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="plot-label">
          {plot.yLabel}
        </text>
        {data.fit && (
          <line
            x1={px(x0)}
            y1={py(data.fit.intercept + data.fit.slope * x0)}
            x2={px(x1)}
            y2={py(data.fit.intercept + data.fit.slope * x1)}
            className="plot-fit"
            clipPath="url(#notebook-plot-area)"
          />
        )}
        {data.points.map((p, index) => (
          <g key={index} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)}>
            {/* Hit target larger than the mark. */}
            <circle cx={px(p.x)} cy={py(p.y)} r={11} fill="transparent" />
            <circle cx={px(p.x)} cy={py(p.y)} r={hovered === index ? 5.5 : 4.5} className="plot-point" />
          </g>
        ))}
      </svg>
      <figcaption>
        {point ? (
          <span className="mono">
            #{hovered! + 1}: {plot.xLabel} = {tick(point.x)} · {plot.yLabel} = {tick(point.y)}
          </span>
        ) : (
          <span>{plot.relation}</span>
        )}
        {!data.fit && <span className="hint"> · record at least {MIN_FIT_POINTS} measurements to fit a line</span>}
      </figcaption>
    </figure>
  )
}
