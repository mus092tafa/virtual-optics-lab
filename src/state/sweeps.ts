/**
 * Demonstration mode: slowly sweeps the key parameter of the current
 * experiment so that its effect can be shown to a class.
 */
import { RAIL_LENGTH } from '../physics/constants'
import { imageDistance } from '../physics/lenses'
import { sequentialImaging } from '../physics/rayTransfer'
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
  'concave-lens': 'concave lens position (screen follows the image)',
  grating: 'screen distance',
  airy: 'aperture diameter',
  malus: 'analyser angle',
  brewster: 'angle of incidence',
  prism: 'angle of incidence',
  'concave-mirror': 'object position (screen follows the image)',
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
    case 'brewster':
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
    case 'concave-lens': {
      const object = find('object')
      const lenses = state.components.filter((c): c is Extract<BenchComponent, { kind: 'lens' }> => c.kind === 'lens')
      const convex = lenses.find((c) => c.focalLength > 0)
      const concave = lenses.find((c) => c.focalLength < 0)
      if (!object || !convex || !concave || !screen) break
      // The image stays real only while the concave lens is closer to the
      // convex lens's image than its own focal length: 1/di = 1/s − 1/|f| > 0.
      const firstImage = convex.x + imageDistance(convex.focalLength, convex.x - object.x)
      const farthest = Math.min(0.85 * Math.abs(concave.focalLength), firstImage - convex.x - cm(2))
      actions.moveComponent(concave.id, firstImage - lerp(farthest, cm(3), t))
      const placed = labStore.get().components.filter((c): c is Extract<BenchComponent, { kind: 'lens' }> => c.kind === 'lens')
      const image = sequentialImaging(placed, object.x)
      if (image && image.isReal && Number.isFinite(image.imageX)) actions.moveComponent(screen.id, Math.min(RAIL_LENGTH, image.imageX))
      break
    }
    case 'grating': {
      const grating = find('grating')
      if (grating && screen) actions.moveComponent(screen.id, grating.x + lerp(cm(10), cm(40), t))
      break
    }
    case 'airy': {
      const pinhole = find('pinhole')
      if (pinhole) actions.updateComponent(pinhole.id, { diameter: mm(lerp(0.4, 0.1, t)) })
      break
    }
    case 'malus': {
      const polarizers = state.components.filter((c) => c.kind === 'polarizer').sort((a, b) => a.x - b.x)
      const analyser = polarizers[polarizers.length - 1]
      if (analyser) actions.updateComponent(analyser.id, { angle: degToRad(lerp(0, 180, t)) })
      break
    }
    case 'prism':
      actions.updatePrism({ incidenceAngle: degToRad(lerp(35, 80, t)) })
      break
    case 'concave-mirror': {
      const object = find('object')
      const mirror = find('mirror')
      if (!object || !mirror || !screen) break
      // The object has to stay between the lamp and the mirror.
      const lamp = state.components.find((c) => c.kind === 'tungsten' || c.kind === 'laser')
      const farthest = Math.min(mirror.focalLength * 3, mirror.x - (lamp?.x ?? 0) - cm(4))
      const objectDistance = lerp(farthest, mirror.focalLength * 1.4, t)
      actions.moveComponent(object.id, mirror.x - objectDistance)
      const actual = mirror.x - (labStore.get().components.find((c) => c.id === object.id)?.x ?? object.x)
      actions.moveComponent(screen.id, Math.max(0, mirror.x - imageDistance(mirror.focalLength, actual)))
      break
    }
  }
}
