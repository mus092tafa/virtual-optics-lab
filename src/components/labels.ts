import { laserLine } from '../physics/constants'
import type { BenchComponent, ComponentKind } from '../physics/types'
import { formatLength, fromMeters } from '../physics/units'

export const KIND_NAMES: Record<ComponentKind, string> = {
  laser: 'He-Ne laser',
  tungsten: 'Tungsten lamp',
  lens: 'Convex lens',
  singleSlit: 'Single slit',
  doubleSlit: 'Double slit',
  object: 'Object',
  screen: 'Screen',
}

/** Short caption drawn above a component on the bench. */
export function componentCaption(component: BenchComponent, showTheory: boolean): string {
  switch (component.kind) {
    case 'laser':
      return `He-Ne ${fromMeters(laserLine(component.lineId).wavelength, 'nm').toFixed(1)} nm`
    case 'tungsten':
      return `Tungsten ${Math.round(component.intensity * 100)}%`
    case 'lens':
      return component.concealed && !showTheory ? 'Lens f = ?' : `Lens f = ${formatLength(component.focalLength, 'cm', 0)}`
    case 'singleSlit':
      return `Slit a = ${formatLength(component.width, 'mm', 3)}`
    case 'doubleSlit':
      return `Double slit d = ${formatLength(component.separation, 'mm', 2)}`
    case 'object':
      return 'Object'
    case 'screen':
      return 'Screen'
  }
}
