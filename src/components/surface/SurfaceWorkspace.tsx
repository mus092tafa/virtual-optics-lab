import { useMemo } from 'react'
import { MATERIALS } from '../../physics/constants'
import { solveSurface } from '../../physics/surface'
import { degToRad, formatAngle, formatNumber, radToDeg } from '../../physics/units'
import { actions, theoryVisible, useLab } from '../../state/labState'
import { ExperimentPanel } from '../ExperimentPanel'
import { SurfaceScene } from './SurfaceScene'
import { MAX_TILT } from './limits'

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

/** Section A: reflection from a plane mirror and refraction at an interface. */
export function SurfaceWorkspace() {
  const surface = useLab((s) => s.surface)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  const solution = useMemo(() => solveSurface(surface), [surface])
  const context = useMemo(() => ({ components: [], bench: null, surface: solution }), [solution])

  const normalAngle = surface.surfaceTilt + Math.PI / 2
  // Signed angle of the source from the normal: |δ| < 90° means the front side.
  const delta = wrap(surface.sourceAngle - normalAngle)
  const side = delta >= 0 ? 1 : -1
  const setIncidence = (theta: number) =>
    actions.updateSurface({ sourceAngle: normalAngle + side * (solution.fromFront ? theta : Math.PI - theta) })
  const flipSide = () => actions.updateSurface({ sourceAngle: normalAngle + side * (Math.PI - Math.abs(delta)) })
  // Only the surface turns; the source stays where it is in the lab frame.
  const setTilt = (tilt: number) => actions.updateSurface({ surfaceTilt: tilt })

  const hidden = (value: string) => (showTheory ? value : 'read from protractor')
  const rows: { label: string; value: string; withheld?: boolean }[] = [
    { label: 'Angle of incidence θi', value: hidden(formatAngle(solution.incidentAngle, 2)), withheld: !showTheory },
  ]
  if (surface.kind === 'mirror') {
    rows.push({
      label: 'Angle of reflection θr',
      value: solution.reflectedAngle === null ? 'none — light strikes the back of the mirror' : hidden(formatAngle(solution.reflectedAngle, 2)),
      withheld: !showTheory && solution.reflectedAngle !== null,
    })
  } else {
    rows.push(
      { label: 'Incident medium index', value: solution.nIncident.toFixed(4) },
      { label: 'Second medium index', value: showTheory ? (solution.nTransmitted ?? 1).toFixed(4) : 'to be determined', withheld: !showTheory },
      { label: 'Angle of reflection θr', value: hidden(formatAngle(solution.reflectedAngle ?? NaN, 2)), withheld: !showTheory },
      {
        label: 'Angle of refraction θ₂',
        value: solution.totalInternalReflection ? 'none — total internal reflection' : hidden(formatAngle(solution.refractedAngle ?? NaN, 2)),
        withheld: !showTheory && !solution.totalInternalReflection,
      },
      {
        label: 'Critical angle θc',
        value: solution.criticalAngle === null ? 'none (n₁ ≤ n₂)' : hidden(formatAngle(solution.criticalAngle, 2)),
        withheld: !showTheory && solution.criticalAngle !== null,
      },
      { label: 'Reflected power R', value: `${formatNumber(100 * solution.reflectance, 1)}%` },
      { label: 'Transmitted power T', value: `${formatNumber(100 * solution.transmittance, 1)}%` },
    )
    if (showTheory && solution.refractedAngle !== null) {
      rows.push({
        label: 'n₁ sinθ₁ = n₂ sinθ₂',
        value: `${formatNumber(solution.nIncident * Math.sin(solution.incidentAngle), 4)} = ${formatNumber((solution.nTransmitted ?? 1) * Math.sin(solution.refractedAngle), 4)}`,
      })
    }
  }

  return (
    <main className="workspace surface-workspace">
      <section className="panel surface-panel" aria-label="Reflection and refraction">
        <header className="panel-header">
          <h2>{surface.kind === 'mirror' ? 'Plane mirror' : 'Interface between two media'}</h2>
          <span className="model-tag imaging">geometric optics</span>
          <span className="panel-sub">drag the laser, the surface handle, or the protractor’s 0 mark</span>
        </header>
        <SurfaceScene surface={surface} solution={solution} showTheory={showTheory} />
      </section>

      <div className="surface-side">
        <section className="panel controls" aria-label="Controls">
          <header className="panel-header">
            <h2>Controls</h2>
          </header>
          <div className="control-body">
            <div className="control-row">
              <label>Surface</label>
              <div className="chip-group">
                <button className={`chip${surface.kind === 'mirror' ? ' active' : ''}`} onClick={() => actions.updateSurface({ kind: 'mirror' })}>
                  Plane mirror
                </button>
                <button className={`chip${surface.kind === 'interface' ? ' active' : ''}`} onClick={() => actions.updateSurface({ kind: 'interface' })}>
                  Transparent interface
                </button>
              </div>
            </div>
            <div className="control-row">
              <label htmlFor="incidence">Incident angle</label>
              <input
                id="incidence"
                type="range"
                min={0}
                max={89.5}
                step={0.5}
                value={Number(radToDeg(solution.incidentAngle).toFixed(1))}
                onChange={(event) => setIncidence(degToRad(Number(event.target.value)))}
              />
              <output>{showTheory ? formatAngle(solution.incidentAngle, 1) : '—'}</output>
            </div>
            <div className="control-row">
              <label htmlFor="tilt">Surface tilt</label>
              <input
                id="tilt"
                type="range"
                min={-radToDeg(MAX_TILT)}
                max={radToDeg(MAX_TILT)}
                step={0.5}
                value={Number(radToDeg(surface.surfaceTilt).toFixed(1))}
                onChange={(event) => setTilt(degToRad(Number(event.target.value)))}
              />
              <output>{formatAngle(surface.surfaceTilt, 1)}</output>
            </div>
            {surface.kind === 'interface' && (
              <>
                <div className="control-row">
                  <label htmlFor="medium1">Medium 1</label>
                  <select id="medium1" value={surface.medium1} onChange={(event) => actions.updateSurface({ medium1: event.target.value })}>
                    {MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (n = {m.n})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-row">
                  <label htmlFor="medium2">Medium 2</label>
                  <select id="medium2" value={surface.medium2} onChange={(event) => actions.updateSurface({ medium2: event.target.value })}>
                    {MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {showTheory ? ` (n = ${m.n})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-row">
                  <span />
                  <button className="chip" onClick={flipSide}>
                    Send light from medium {solution.fromFront ? '2' : '1'}
                  </button>
                </div>
              </>
            )}
            <div className="control-row">
              <label className="check">
                <input type="checkbox" checked={surface.showNormal} onChange={(event) => actions.updateSurface({ showNormal: event.target.checked })} />
                Normal line
              </label>
              <label className="check">
                <input type="checkbox" checked={surface.showProtractor} onChange={(event) => actions.updateSurface({ showProtractor: event.target.checked })} />
                Protractor
              </label>
              <button className="chip" onClick={() => actions.updateSurface({ protractorAngle: normalAngle })}>
                Align protractor to normal
              </button>
            </div>
          </div>
        </section>

        <section className="panel physics" aria-label="Measurements">
          <header className="panel-header">
            <h2>Physics</h2>
            {mode === 'experiment' && (
              <button className="chip" onClick={() => actions.setRevealed(!revealed)}>
                {revealed ? 'Hide theory' : 'Reveal theory'}
              </button>
            )}
          </header>
          <div className="physics-body">
            {solution.totalInternalReflection && <p className="notice warning">Total internal reflection: the angle of incidence exceeds the critical angle, so no light is transmitted.</p>}
            {surface.kind === 'mirror' && !solution.fromFront && <p className="notice warning">The ray strikes the back of the mirror and is absorbed.</p>}
            <div className="report-section">
              <dl>
                {rows.map((row) => (
                  <div key={row.label} className="report-row">
                    <dt>{row.label}</dt>
                    <dd className={row.withheld ? 'withheld' : undefined}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </div>

      <div className="bottom-row single">
        <ExperimentPanel context={context} />
      </div>
    </main>
  )
}
