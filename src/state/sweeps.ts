/**
 * Demonstration mode: slowly sweeps the key parameter of the current
 * experiment so that its effect can be shown to a class.
 */
import { RAIL_LENGTH } from '../physics/constants'
import { imageDistance } from '../physics/lenses'
import type { BenchComponent } from '../physics/types'
import { cm, degToRad, mm, um } from '../physics/units'
import { actions, labStore } from './labState'
import type { ExperimentId } from './presets'

export const SWEEP_LABELS: Record<ExperimentId, string> = {
  reflection: 'angle of incidence',
  refraction: 'angle of incidence',
  'convex-lens': 'screen position',
  magnification: 'object position (screen follows the image)',
  'hene-lens': 'screen position',
  'single-slit': 'slit width',
  'double-slit': 'slit separation',
  tungsten: 'lamp intensity',
  michelson: 'mirror M2 (fine)',
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Applies the sweep at phase t ∈ [0, 1]. */
export function applySweep(id: ExperimentId, t: number): void {
  const state = labStore.get()
  const find = <K extends BenchComponent['kind']>(kind: K) =>
    state.components.find((c): c is Extract<BenchComponent, { kind: K }> => c.kind === kind)
  const lens = find('lens')
  const screen = find('screen')
  switch (id) {
    case 'reflection':
    case 'refraction':
      actions.updateSurface({ sourceAngle: state.surface.surfaceTilt + Math.PI / 2 + degToRad(lerp(5, 80, t)) })
      break
    case 'convex-lens':
      if (lens && screen) actions.moveComponent(screen.id, lens.x + lerp(cm(8), cm(30), t))
      break
    case 'hene-lens':
      if (lens && screen) actions.moveComponent(screen.id, lens.x + lerp(cm(2), cm(40), t))
      break
    case 'magnification': {
      const object = find('object')
      if (!lens || !object || !screen) break
      const objectDistance = lerp(lens.focalLength * 3, lens.focalLength * 1.35, t)
      actions.moveComponent(object.id, lens.x - objectDistance)
      const actual = lens.x - (labStore.get().components.find((c) => c.id === object.id)?.x ?? object.x)
      actions.moveComponent(screen.id, Math.min(RAIL_LENGTH, lens.x + imageDistance(lens.focalLength, actual)))
      break
    }
    case 'single-slit': {
      const slit = find('singleSlit')
      if (slit) actions.updateComponent(slit.id, { width: mm(lerp(0.3, 0.03, t)) })
      break
    }
    case 'double-slit': {
      const slits = find('doubleSlit')
      if (slits) actions.updateComponent(slits.id, { separation: Math.max(mm(lerp(0.12, 0.6, t)), slits.width + mm(0.02)) })
      break
    }
    case 'michelson':
      actions.updateInterferometer({ fine: um(lerp(0, 3, t)) })
      break
    case 'tungsten': {
      const lamp = find('tungsten')
      if (lamp) actions.updateComponent(lamp.id, { intensity: lerp(0.05, 1, t) })
      break
    }
  }
}
