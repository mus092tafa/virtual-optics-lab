import { laserLine } from '../physics/constants'
import type { BenchComponent, ComponentKind } from '../physics/types'
import { formatAngle, formatLength, formatNumber, fromMeters, toPerMm } from '../physics/units'

export const KIND_NAMES: Record<ComponentKind, string> = {
  laser: 'He-Ne laser',
  tungsten: 'Tungsten lamp',
  lens: 'Lens',
  singleSlit: 'Single slit',
  doubleSlit: 'Double slit',
  grating: 'Diffraction grating',
  pinhole: 'Circular aperture',
  polarizer: 'Polariser',
  mirror: 'Spherical mirror',
  object: 'Object',
  screen: 'Screen',
}

/** Name of a mounted component, including whether it converges or diverges light. */
export function componentName(component: BenchComponent): string {
  if (component.kind === 'lens') return component.focalLength < 0 ? 'Concave lens' : 'Convex lens'
  if (component.kind === 'mirror') return component.focalLength < 0 ? 'Convex mirror' : 'Concave mirror'
  return KIND_NAMES[component.kind]
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
    case 'grating':
      return `Grating ${formatNumber(toPerMm(component.lineDensity), 0)} /mm`
    case 'pinhole':
      return `Aperture ⌀ ${formatLength(component.diameter, 'mm', 2)}`
    case 'polarizer':
      return `Polariser ${formatAngle(component.angle, 0)}`
    case 'mirror':
      return `Mirror f = ${formatLength(component.focalLength, 'cm', 0)}`
    case 'object':
      return 'Object'
    case 'screen':
      return 'Screen'
  }
}
