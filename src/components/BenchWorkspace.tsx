import { useMemo } from 'react'
import { solveBench } from '../physics/optics'
import { actions, theoryVisible, useLab } from '../state/labState'
import { BEAM_ZOOM_FACTOR } from './bench/glyphMetrics'
import { ComponentPalette } from './ComponentPalette'
import { ControlPanel } from './ControlPanel'
import { ExperimentPanel } from './ExperimentPanel'
import { OpticalBench } from './OpticalBench'
import { PhysicsPanel } from './PhysicsPanel'
import { ScreenOutput } from './ScreenOutput'
import { buildReport } from './report'

/** Section B: the optical bench with its live screen output. */
export function BenchWorkspace() {
  const components = useLab((s) => s.components)
  const diffractionModel = useLab((s) => s.diffractionModel)
  const showRays = useLab((s) => s.showRays)
  const rulerTool = useLab((s) => s.rulerTool)
  const beamZoom = useLab((s) => s.beamZoom)
  const view = useLab((s) => s.view)
  const mode = useLab((s) => s.mode)
  const revealed = useLab((s) => s.revealed)
  const showTheory = theoryVisible({ mode, revealed })

  // The single place where the physical system is solved. Everything displayed
  // on the bench, the screen and the panels derives from this result.
  const solution = useMemo(() => solveBench(components, { diffractionModel }), [components, diffractionModel])
  const report = useMemo(() => buildReport(solution, components), [solution, components])
  const context = useMemo(() => ({ components, bench: solution, surface: null }), [components, solution])

  const zoom = (factor: number) => {
    const centre = (view.x0 + view.x1) / 2
    const half = ((view.x1 - view.x0) * factor) / 2
    actions.setView({ x0: centre - half, x1: centre + half })
  }

  return (
    <main className="workspace bench-workspace">
      <ComponentPalette />

      <section className="panel bench-panel" aria-label="Optical bench">
        <header className="panel-header">
          <h2>Optical bench</h2>
          <span className={`model-tag ${solution.regime}`}>{solution.model}</span>
          <div className="bench-tools">
            <label className={`check${showTheory ? '' : ' disabled'}`} title={showTheory ? 'Principal rays through each lens' : 'Available once the theory is revealed'}>
              <input type="checkbox" checked={showRays && showTheory} disabled={!showTheory} onChange={(event) => actions.set('showRays', event.target.checked)} />
              Show rays
            </label>
            <label className="check" title="Drag on the bench to measure a distance">
              <input type="checkbox" checked={rulerTool} onChange={(event) => actions.set('rulerTool', event.target.checked)} />
              Ruler
            </label>
            {solution.overlay.beam && (
              <label className="check" title="Draws the beam wider than it is so that focusing is visible. Display only: the physics is unchanged.">
                <input type="checkbox" checked={beamZoom && showTheory} disabled={!showTheory} onChange={(event) => actions.set('beamZoom', event.target.checked)} />
                Beam ×{BEAM_ZOOM_FACTOR}
              </label>
            )}
            {solution.diffraction && (
              <label className="check">
                Model
                <select value={diffractionModel} onChange={(event) => actions.set('diffractionModel', event.target.value as typeof diffractionModel)}>
                  <option value="fraunhofer">Fraunhofer</option>
                  <option value="fresnel">Fresnel</option>
                </select>
              </label>
            )}
            <button className="chip" onClick={() => zoom(1 / 1.4)} aria-label="Zoom in">
              +
            </button>
            <button className="chip" onClick={() => zoom(1.4)} aria-label="Zoom out">
              −
            </button>
            <button className="chip" onClick={() => actions.fitView()}>
              Fit rail
            </button>
          </div>
        </header>
        <OpticalBench solution={solution} />
      </section>

      <ScreenOutput solution={solution} />

      <div className="bottom-row">
        <ControlPanel />
        <PhysicsPanel sections={report} notices={solution.notices} />
        <ExperimentPanel context={context} />
      </div>
    </main>
  )
}
