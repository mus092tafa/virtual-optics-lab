import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SCREEN_HALF_SIZE } from '../physics/constants'
import type { BenchSolution } from '../physics/optics'
import { formatLength, formatNumber, fromMeters, mm } from '../physics/units'
import { drawGraticule, intensityProfile, renderScreen } from '../render/screenRenderer'
import { actions, theoryVisible, useLab } from '../state/labState'

const CANVAS_SIZE = 520
const FOV_PRESETS = [mm(120), mm(60), mm(30), mm(10), mm(3), mm(1)]

interface Mark {
  u0: number
  v0: number
  u1: number
  v1: number
}

/** The observation screen: shows the light distribution the bench delivers to it. */
export function ScreenOutput({ solution }: { solution: BenchSolution }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fov = useLab((s) => s.screenFov)
  const exposure = useLab((s) => s.exposure)
  const showProfile = useLab((s) => s.showProfile)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  const light = solution.screenLight
  const [cursor, setCursor] = useState<{ u: number; v: number } | null>(null)
  const [mark, setMark] = useState<Mark | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Coalesce rapid updates (dragging) into one paint per frame.
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')!
      const viewport = { size: CANVAS_SIZE, fov, exposure }
      renderScreen(ctx, light, viewport)
      drawGraticule(ctx, viewport)
    })
    return () => cancelAnimationFrame(frame)
  }, [light, fov, exposure])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      actions.setScreenFov(fov * Math.exp(event.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [fov])

  const profile = useMemo(() => (showProfile ? intensityProfile(light, fov, 520) : null), [light, fov, showProfile])

  const locate = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      u: ((event.clientX - rect.left) / rect.width - 0.5) * fov,
      v: (0.5 - (event.clientY - rect.top) / rect.height) * fov,
    }
  }
  const toPercent = (u: number, v: number) => ({ left: `${(u / fov + 0.5) * 100}%`, top: `${(0.5 - v / fov) * 100}%` })

  const message = !light
    ? 'No screen on the bench'
    : light.kind === 'dark' || light.kind === 'unsupported'
      ? light.reason
      : null
  const focus = solution.imaging?.screen

  return (
    <section className="panel screen-panel" aria-label="Screen output">
      <header className="panel-header">
        <h2>Screen</h2>
        <span className="panel-sub">light arriving at the observation plane</span>
      </header>

      <div className="screen-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="screen-canvas"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            const p = locate(event)
            dragging.current = true
            setMark({ u0: p.u, v0: p.v, u1: p.u, v1: p.v })
          }}
          onPointerMove={(event) => {
            const p = locate(event)
            setCursor(p)
            if (dragging.current) setMark((m) => (m ? { ...m, u1: p.u, v1: p.v } : m))
          }}
          onPointerUp={() => {
            dragging.current = false
            setMark((m) => (m && Math.hypot(m.u1 - m.u0, m.v1 - m.v0) < fov / 200 ? null : m))
          }}
          onPointerLeave={() => setCursor(null)}
        />
        {mark && (
          <svg className="screen-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={(mark.u0 / fov + 0.5) * 100}
              y1={(0.5 - mark.v0 / fov) * 100}
              x2={(mark.u1 / fov + 0.5) * 100}
              y2={(0.5 - mark.v1 / fov) * 100}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {mark && (
          <>
            <span className="screen-handle" style={toPercent(mark.u0, mark.v0)} />
            <span className="screen-handle" style={toPercent(mark.u1, mark.v1)} />
          </>
        )}
        {message && <div className="screen-message">{message}</div>}
        {showTheory && focus && light?.kind === 'image' && (
          <div className={`focus-badge ${focus.inFocus ? 'sharp' : 'blurred'}`}>
            {focus.inFocus ? 'in focus' : `out of focus · blur ⌀ ${formatLength(focus.blurDiameter, 'mm', 2)}`}
          </div>
        )}
      </div>

      <div className="screen-readout">
        <span>
          {cursor ? (
            <>
              u = {formatLength(cursor.u, 'mm', 2)} &nbsp; v = {formatLength(cursor.v, 'mm', 2)}
            </>
          ) : (
            'cursor: —'
          )}
        </span>
        <span className="measure-value">
          {mark ? (
            <>
              Δu = {formatLength(Math.abs(mark.u1 - mark.u0), 'mm', 2)} · Δv = {formatLength(Math.abs(mark.v1 - mark.v0), 'mm', 2)} · |Δ| ={' '}
              {formatLength(Math.hypot(mark.u1 - mark.u0, mark.v1 - mark.v0), 'mm', 2)}
            </>
          ) : (
            'drag on the screen to measure'
          )}
        </span>
      </div>

      {profile && (
        <div className="profile">
          <svg viewBox="0 0 520 90" preserveAspectRatio="none" aria-label="Intensity profile">
            <line x1={260} x2={260} y1={0} y2={90} className="profile-axis" />
            <polyline
              className="profile-line"
              vectorEffect="non-scaling-stroke"
              points={Array.from(profile.values, (value, i) => `${i + 0.5},${(86 - 82 * Math.min(1, value)).toFixed(2)}`).join(' ')}
            />
          </svg>
          <div className="profile-caption">
            <span>−{formatNumber(fromMeters(fov / 2, 'mm'), 1)} mm</span>
            <span>I/I₀ · {profile.axis} axis</span>
            <span>+{formatNumber(fromMeters(fov / 2, 'mm'), 1)} mm</span>
          </div>
        </div>
      )}

      <div className="screen-controls">
        <div className="control-row">
          <label htmlFor="fov">Field of view</label>
          <div className="chip-group" id="fov">
            {FOV_PRESETS.map((value) => (
              <button
                key={value}
                className={`chip${Math.abs(value - fov) / value < 0.02 ? ' active' : ''}`}
                onClick={() => actions.setScreenFov(value)}
                title={value >= 2 * SCREEN_HALF_SIZE ? 'Whole screen' : undefined}
              >
                {fromMeters(value, 'mm')} mm
              </button>
            ))}
          </div>
        </div>
        <div className="control-row">
          <label htmlFor="exposure">Exposure</label>
          <input
            id="exposure"
            type="range"
            min={0}
            max={2.3}
            step={0.01}
            value={Math.log10(exposure)}
            onChange={(event) => actions.set('exposure', Math.pow(10, Number(event.target.value)))}
          />
          <output>{exposure < 10 ? exposure.toFixed(1) : exposure.toFixed(0)}×</output>
        </div>
        <div className="control-row end between">
          <label className="check">
            <input type="checkbox" checked={showProfile} onChange={(event) => actions.set('showProfile', event.target.checked)} />
            Intensity profile
          </label>
          {mark && (
            <button className="chip" onClick={() => setMark(null)}>
              clear measurement
            </button>
          )}
          <span className="hint">scroll to zoom</span>
        </div>
      </div>
    </section>
  )
}
