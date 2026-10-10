import { useMemo } from 'react'
import { HENE_LINES, laserLine } from '../../physics/constants'
import { OPTICAL_GLASSES, abbeNumber, opticalGlass, refractiveIndex } from '../../physics/dispersion'
import { incidenceAtMinimumDeviation, minimumDeviation, solvePrism } from '../../physics/prism'
import { wavelengthToRgb } from '../../physics/spectrum'
import { degToRad, formatAngle, formatLength, formatNumber, nm, radToDeg } from '../../physics/units'
import { PRISM_APEX_RANGE, PRISM_INCIDENCE_RANGE, actions, theoryVisible, useLab } from '../../state/labState'
import type { PrismSetting } from '../../state/presets'
import { ExperimentPanel } from '../ExperimentPanel'
import type { ReportSection } from '../report'
import { PrismScene } from './PrismScene'
import type { PrismRay } from './PrismScene'

/** Wavelengths traced for white light, violet to red. */
const WHITE_WAVELENGTHS = [420, 463, 507, 550, 593, 637, 680].map(nm)
/** Wavelength for which numbers are quoted in white light (sodium D). */
const WHITE_REFERENCE = nm(589.3)

/** The ray of one wavelength through the prism, with the index of the glass at that wavelength. */
function trace(prism: PrismSetting, wavelength: number) {
  return solvePrism({
    apexAngle: prism.apexAngle,
    incidenceAngle: prism.incidenceAngle,
    index: refractiveIndex(opticalGlass(prism.glassId), wavelength),
  })
}

/** Section A: refraction and dispersion in a prism. */
export function PrismWorkspace() {
  const prism = useLab((s) => s.prism)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })
  const glass = opticalGlass(prism.glassId)
  const white = prism.light === 'white'
  const wavelength = white ? WHITE_REFERENCE : laserLine(prism.light).wavelength
  const index = refractiveIndex(glass, wavelength)

  const solution = trace(prism, wavelength)
  const rays: PrismRay[] = (white ? WHITE_WAVELENGTHS : [wavelength]).map((lambda) => ({
    wavelength: lambda,
    rgb: wavelengthToRgb(lambda),
    solution: trace(prism, lambda),
  }))
  const context = useMemo(() => {
    const lambda = prism.light === 'white' ? WHITE_REFERENCE : laserLine(prism.light).wavelength
    return {
      components: [],
      bench: null,
      surface: null,
      michelson: null,
      prism: { apexAngle: prism.apexAngle, wavelength: lambda, index: refractiveIndex(opticalGlass(prism.glassId), lambda) },
    }
  }, [prism.apexAngle, prism.glassId, prism.light])

  const deltaMin = minimumDeviation(prism.apexAngle, index)
  const symmetric = incidenceAtMinimumDeviation(prism.apexAngle, index)
  const violet = rays[0].solution.deviation
  const red = rays[rays.length - 1].solution.deviation

  const rows: { label: string; value: string; theory?: boolean }[] = [
    { label: 'Glass', value: glass.name },
    { label: 'Apex angle A', value: formatAngle(prism.apexAngle, 1) },
    { label: white ? 'Light' : 'Wavelength λ', value: white ? 'white (values quoted at 589.3 nm)' : formatLength(wavelength, 'nm', 1) },
    { label: 'Angle of incidence θ₁', value: formatAngle(prism.incidenceAngle, 1) },
    // Read from the spectrometer table: shown in every mode.
    { label: 'Deviation δ (reading)', value: solution.deviation === null ? 'no emergent ray' : formatAngle(solution.deviation, 2) },
    ...(white
      ? [{ label: 'Angular spread δ(420 nm) − δ(680 nm)', value: violet === null || red === null ? '—' : formatAngle(violet - red, 2) }]
      : []),
    { label: 'Transmitted power', value: `${formatNumber(100 * solution.transmittance, 1)}%` },
    { label: 'Refractive index n(λ)', value: formatNumber(index, 4), theory: true },
    { label: 'Refraction angle θ₁′', value: formatAngle(solution.refractionAngle1, 2), theory: true },
    { label: 'Internal incidence θ₂′ = A − θ₁′', value: solution.incidenceAngle2 === null ? '—' : formatAngle(solution.incidenceAngle2, 2), theory: true },
    { label: 'Angle of emergence θ₂', value: solution.emergenceAngle === null ? '—' : formatAngle(solution.emergenceAngle, 2), theory: true },
    { label: 'Minimum deviation δ_min', value: deltaMin === null ? 'none' : formatAngle(deltaMin, 2), theory: true },
    { label: '  at angle of incidence', value: symmetric === null ? '—' : formatAngle(symmetric, 2), theory: true },
    { label: 'Abbe number V_d', value: formatNumber(abbeNumber(glass), 1), theory: true },
  ]
  const setup: ReportSection[] = [{ title: 'Prism', rows: rows.map((row) => ({ label: row.label, value: row.value, theory: row.theory })) }]

  return (
    <main className="workspace surface-workspace">
      <section className="panel surface-panel" aria-label="Prism">
        <header className="panel-header">
          <h2>Prism</h2>
          <span className="model-tag imaging">geometric optics</span>
          <span className="panel-sub">rotate the prism with the angle of incidence and watch the deviation</span>
        </header>
        <PrismScene rays={rays} showTheory={showTheory} />
      </section>

      <div className="surface-side">
        <section className="panel controls" aria-label="Controls">
          <header className="panel-header">
            <h2>Controls</h2>
          </header>
          <div className="control-body">
            <div className="control-row">
              <label htmlFor="prism-incidence">Angle of incidence</label>
              <input
                id="prism-incidence"
                type="range"
                min={radToDeg(PRISM_INCIDENCE_RANGE.min)}
                max={radToDeg(PRISM_INCIDENCE_RANGE.max)}
                step={0.1}
                value={Number(radToDeg(prism.incidenceAngle).toFixed(1))}
                onChange={(event) => actions.updatePrism({ incidenceAngle: degToRad(Number(event.target.value)) })}
              />
              <output>{formatAngle(prism.incidenceAngle, 1)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="prism-apex">Apex angle A</label>
              <input
                id="prism-apex"
                type="range"
                min={radToDeg(PRISM_APEX_RANGE.min)}
                max={radToDeg(PRISM_APEX_RANGE.max)}
                step={1}
                value={Number(radToDeg(prism.apexAngle).toFixed(0))}
                onChange={(event) => actions.updatePrism({ apexAngle: degToRad(Number(event.target.value)) })}
              />
              <output>{formatAngle(prism.apexAngle, 0)}</output>
            </div>
            <div className="control-row">
              <label htmlFor="prism-glass">Glass</label>
              <select id="prism-glass" value={prism.glassId} onChange={(event) => actions.updatePrism({ glassId: event.target.value })}>
                {OPTICAL_GLASSES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-row">
              <label htmlFor="prism-light">Light</label>
              <select id="prism-light" value={prism.light} onChange={(event) => actions.updatePrism({ light: event.target.value })}>
                {HENE_LINES.map((line) => (
                  <option key={line.id} value={line.id}>
                    He-Ne {line.label}
                  </option>
                ))}
                <option value="white">White light</option>
              </select>
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
            {solution.outcome === 'total-internal-reflection' && (
              <p className="notice warning">Total internal reflection at the second face: the internal angle of incidence exceeds the critical angle, so no ray emerges.</p>
            )}
            {solution.outcome === 'misses-second-face' && (
              <p className="notice warning">The refracted ray reaches the base of the prism before the second face. This path is not modelled; increase the angle of incidence.</p>
            )}
            <div className="report-section">
              <dl>
                {rows.map((row) => (
                  <div key={row.label} className={`report-row${row.label.startsWith('  ') ? ' sub' : ''}`}>
                    <dt>{row.label.trim()}</dt>
                    <dd className={row.theory && !showTheory ? 'withheld' : undefined}>{row.theory && !showTheory ? 'to be determined' : row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </div>

      <div className="bottom-row single">
        <ExperimentPanel context={context} setup={setup} />
      </div>
    </main>
  )
}
