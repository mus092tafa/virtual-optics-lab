import { useEffect, useMemo, useState } from 'react'
import {
  EXPANDER_FOCAL_LENGTHS,
  HENE_LINES,
  HENE_WAIST_RADIUS,
  MICHELSON_LASER_TO_LENS,
  MICHELSON_LENS_TO_SPLITTER,
  laserLine,
} from '../../physics/constants'
import { displacementPerFringe, solveMichelson } from '../../physics/michelson'
import type { ScreenLight } from '../../physics/optics'
import { wavelengthToRgb } from '../../physics/spectrum'
import { cm, formatLength, formatNumber, fromMeters, mm, um } from '../../physics/units'
import { COARSE_RANGE, FINE_RANGE, TILT_RANGE, actions, theoryVisible, useLab } from '../../state/labState'
import { ExperimentPanel } from '../ExperimentPanel'
import { ScreenOutput } from '../ScreenOutput'
import { cssRgb } from '../hooks'
import { MichelsonScene } from './MichelsonScene'

const SCAN_DISTANCE = um(10)
const SCAN_DURATION_MS = 12000

/** Section C: Michelson interferometer. */
export function InterferometerWorkspace() {
  const setup = useLab((s) => s.interferometer)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  const [scanning, setScanning] = useState(false)
  const line = laserLine(setup.lineId)
  const showWavelength = showTheory || !setup.concealed
  const displacement = setup.coarse + setup.fine

  const solution = useMemo(
    () =>
      solveMichelson({
        wavelength: line.wavelength,
        waistRadius: HENE_WAIST_RADIUS,
        laserToLens: MICHELSON_LASER_TO_LENS,
        expanderFocalLength: setup.expanderFocalLength,
        lensToSplitter: MICHELSON_LENS_TO_SPLITTER,
        armLength: setup.armLength,
        mirrorDisplacement: displacement,
        tiltX: setup.tiltX,
        tiltY: setup.tiltY,
        splitterToScreen: setup.splitterToScreen,
      }),
    [line.wavelength, setup.expanderFocalLength, setup.armLength, displacement, setup.tiltX, setup.tiltY, setup.splitterToScreen],
  )
  const rgb = useMemo(() => wavelengthToRgb(line.wavelength), [line.wavelength])
  const light = useMemo<ScreenLight>(() => ({ kind: 'field', rgb, level: 1, intensity: solution.intensity }), [rgb, solution])
  const context = useMemo(() => ({ components: [], bench: null, surface: null, michelson: solution, prism: null }), [solution])

  // The fringe counter reads the number of fringes that have passed the centre since it was reset.
  const needsReference = setup.counterReference === null
  useEffect(() => {
    if (needsReference) actions.updateInterferometer({ counterReference: solution.centreOrder })
  }, [needsReference, solution.centreOrder])
  const passed = setup.counterReference === null ? 0 : solution.centreOrder - setup.counterReference
  const counted = Math.floor(Math.abs(passed) + 1e-6)

  // Motorised scan of M2 at constant speed.
  useEffect(() => {
    if (!scanning) return
    const startFine = setup.fine
    const target = Math.min(FINE_RANGE, startFine + SCAN_DISTANCE)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SCAN_DURATION_MS)
      actions.updateInterferometer({ fine: startFine + (target - startFine) * t })
      if (t < 1) frame = requestAnimationFrame(tick)
      else setScanning(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // The scan runs from the reading at the moment it was started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  const set = actions.updateInterferometer
  const tiltMagnitude = Math.hypot(solution.beamOffset.x, solution.beamOffset.y)
  const notices: { level: 'info' | 'warning'; text: string }[] = []
  if (setup.expanderFocalLength === null) {
    notices.push({ level: 'info', text: 'Without the expander lens the two beams are narrow and nearly plane: the whole spot brightens and darkens as M2 moves. Insert the lens to see circular fringes.' })
  }
  if (displacement === 0 && setup.tiltX === 0 && setup.tiltY === 0) {
    notices.push({ level: 'info', text: 'Equal arms and aligned mirrors: zero path difference. The two beams cancel on the screen (π phase difference from the beam splitter) and the light returns towards the laser.' })
  }
  if (tiltMagnitude > solution.arms[0].radius) {
    notices.push({ level: 'warning', text: 'The mirror is tilted so far that the two beams barely overlap on the screen; fringes appear only where they do.' })
  }

  const withheld = (value: string, theory = true) => ({ value: theory && !showTheory ? 'to be measured' : value, hidden: theory && !showTheory })
  const rows: { label: string; value: string; hidden: boolean }[] = [
    { label: 'Light source', ...withheld('He-Ne laser (coherent)', false) },
    { label: 'Wavelength λ', ...(showWavelength ? withheld(formatLength(line.wavelength, 'nm', 1), false) : { value: 'to be measured', hidden: true }) },
    { label: 'Arm length L₁ (M1)', ...withheld(formatLength(setup.armLength, 'cm', 1), false) },
    { label: 'Mirror displacement d', ...withheld(`${formatNumber(fromMeters(displacement, 'um'), 2)} µm`, false) },
    { label: 'Path difference 2d', ...withheld(`${formatNumber(fromMeters(solution.pathDifference, 'um'), 2)} µm`, false) },
    { label: 'Fringes passed (counter)', ...withheld(String(counted), false) },
    { label: 'Order at centre 2d/λ', ...(showWavelength ? withheld(formatNumber(solution.centreOrder, 2)) : { value: 'to be measured', hidden: true }) },
    { label: 'Mirror travel per fringe λ/2', ...(showWavelength ? withheld(formatLength(displacementPerFringe(line.wavelength), 'nm', 1)) : { value: 'to be measured', hidden: true }) },
    { label: 'Intensity at centre I/I_max', ...withheld(formatNumber(solution.centreIntensity, 3), false) },
    { label: 'Beam radius on screen', ...withheld(formatLength(solution.arms[0].radius, 'mm', 2), false) },
    { label: 'Ring scale (order changes by 1)', ...withheld(formatLength(solution.ringScale, 'mm', 2)) },
    { label: 'Tilt fringe spacing', ...withheld(Number.isFinite(solution.tiltFringeSpacing) ? formatLength(solution.tiltFringeSpacing, 'mm', 3) : 'none (mirrors aligned)') },
  ]

  return (
    <main className="workspace interferometer-workspace">
      <section className="panel bench-panel" aria-label="Michelson interferometer">
        <header className="panel-header">
          <h2>Michelson interferometer</h2>
          <span className="model-tag diffraction">wave optics</span>
          <span className="panel-sub">two-beam interference of Gaussian beams</span>
        </header>
        <MichelsonScene
          setup={setup}
          solution={solution}
          beamColor={cssRgb(rgb)}
          laserLabel={showWavelength ? `${formatLength(line.wavelength, 'nm', 1)}` : 'λ = ?'}
        />
      </section>

      <ScreenOutput light={light} />

      <div className="bottom-row">
        <section className="panel controls" aria-label="Controls">
          <header className="panel-header">
            <h2>Controls</h2>
            <span className="panel-sub">micrometer and mirror adjustment</span>
          </header>
          <div className="control-body">
            <div className="micrometer" aria-live="off">
              <div>
                <span>M2 micrometer d</span>
                <strong>{formatNumber(fromMeters(displacement, 'um'), 2)} µm</strong>
              </div>
              <div>
                <span>Fringe counter</span>
                <strong>{counted}</strong>
              </div>
            </div>
            <div className="control-row">
              <label htmlFor="m2-coarse">M2 coarse</label>
              <input
                id="m2-coarse"
                type="range"
                min={-fromMeters(COARSE_RANGE, 'mm')}
                max={fromMeters(COARSE_RANGE, 'mm')}
                step={0.01}
                value={Number(fromMeters(setup.coarse, 'mm').toFixed(2))}
                onChange={(event) => set({ coarse: mm(Number(event.target.value)) })}
              />
              <output>{formatLength(setup.coarse, 'mm', 2)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="m2-fine">M2 fine</label>
              <input
                id="m2-fine"
                type="range"
                min={-fromMeters(FINE_RANGE, 'um')}
                max={fromMeters(FINE_RANGE, 'um')}
                step={0.01}
                value={Number(fromMeters(setup.fine, 'um').toFixed(2))}
                onChange={(event) => set({ fine: um(Number(event.target.value)) })}
              />
              <output>{formatNumber(fromMeters(setup.fine, 'um'), 2)} µm</output>
            </div>
            <div className="control-row end">
              <button className="chip" onClick={() => set({ fine: setup.fine - um(0.02) })}>
                −20 nm
              </button>
              <button className="chip" onClick={() => set({ fine: setup.fine + um(0.02) })}>
                +20 nm
              </button>
              <button className={`chip${scanning ? ' active' : ''}`} onClick={() => setScanning((value) => !value)}>
                {scanning ? '■ Stop scan' : `▶ Scan +${fromMeters(SCAN_DISTANCE, 'um')} µm`}
              </button>
              <button className="chip" onClick={() => set({ counterReference: solution.centreOrder })}>
                Reset counter
              </button>
            </div>
            <div className="control-row">
              <label htmlFor="tilt-x">M2 tilt (horizontal)</label>
              <input
                id="tilt-x"
                type="range"
                min={-TILT_RANGE * 1e3}
                max={TILT_RANGE * 1e3}
                step={0.005}
                value={Number((setup.tiltX * 1e3).toFixed(3))}
                onChange={(event) => set({ tiltX: Number(event.target.value) / 1e3 })}
              />
              <output>{formatNumber(setup.tiltX * 1e3, 3)} mrad</output>
            </div>
            <div className="control-row">
              <label htmlFor="tilt-y">M2 tilt (vertical)</label>
              <input
                id="tilt-y"
                type="range"
                min={-TILT_RANGE * 1e3}
                max={TILT_RANGE * 1e3}
                step={0.005}
                value={Number((setup.tiltY * 1e3).toFixed(3))}
                onChange={(event) => set({ tiltY: Number(event.target.value) / 1e3 })}
              />
              <output>{formatNumber(setup.tiltY * 1e3, 3)} mrad</output>
            </div>
            <div className="control-row end">
              <button className="chip" onClick={() => set({ tiltX: 0, tiltY: 0 })}>
                Align mirrors
              </button>
              <button className="chip" onClick={() => set({ coarse: 0, fine: 0, counterReference: null })}>
                Zero path difference
              </button>
            </div>
            <div className="control-row">
              <label>Expander lens</label>
              <div className="chip-group">
                <button className={`chip${setup.expanderFocalLength === null ? ' active' : ''}`} onClick={() => set({ expanderFocalLength: null, counterReference: null })}>
                  none
                </button>
                {EXPANDER_FOCAL_LENGTHS.map((f) => (
                  <button
                    key={f}
                    className={`chip${setup.expanderFocalLength !== null && Math.abs(setup.expanderFocalLength - f) < 1e-9 ? ' active' : ''}`}
                    onClick={() => set({ expanderFocalLength: f, counterReference: null })}
                  >
                    {formatLength(f, 'cm', 0)}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-row">
              <label htmlFor="arm-length">Arm length L₁</label>
              <input
                id="arm-length"
                type="range"
                min={8}
                max={25}
                step={0.5}
                value={fromMeters(setup.armLength, 'cm')}
                onChange={(event) => set({ armLength: cm(Number(event.target.value)), counterReference: null })}
              />
              <output>{formatLength(setup.armLength, 'cm', 1)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="screen-distance">Screen distance</label>
              <input
                id="screen-distance"
                type="range"
                min={10}
                max={50}
                step={0.5}
                value={fromMeters(setup.splitterToScreen, 'cm')}
                onChange={(event) => set({ splitterToScreen: cm(Number(event.target.value)), counterReference: null })}
              />
              <output>{formatLength(setup.splitterToScreen, 'cm', 1)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="michelson-line">Laser line</label>
              {showWavelength ? (
                <select id="michelson-line" value={setup.lineId} onChange={(event) => set({ lineId: event.target.value, concealed: false, counterReference: null })}>
                  {HENE_LINES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="concealed">unknown — measure it</span>
              )}
              <button className="chip" onClick={() => actions.useUnknownLaser()}>
                Use unknown laser
              </button>
            </div>
          </div>
        </section>

        <section className="panel physics" aria-label="Physics">
          <header className="panel-header">
            <h2>Physics</h2>
            {mode === 'experiment' && (
              <button className="chip" onClick={() => actions.setRevealed(!revealed)}>
                {revealed ? 'Hide theory' : 'Reveal theory'}
              </button>
            )}
          </header>
          <div className="physics-body">
            {notices.map((notice) => (
              <p key={notice.text} className={`notice ${notice.level}`}>
                {notice.text}
              </p>
            ))}
            <div className="report-section">
              <h3>Interferometer</h3>
              <dl>
                {rows.map((row) => (
                  <div key={row.label} className="report-row">
                    <dt>{row.label}</dt>
                    <dd className={row.hidden ? 'withheld' : undefined}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <ExperimentPanel context={context} />
      </div>
    </main>
  )
}
