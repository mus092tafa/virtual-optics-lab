import { SCREEN_HALF_SIZE } from '../../physics/constants'
import type { BenchComponent } from '../../physics/types'
import { mm } from '../../physics/units'

/** Half height of the plate that carries the slit(s). */
export const SLIT_PLATE_HALF_HEIGHT = mm(26)

/** Factor by which the drawn laser beam width is exaggerated when "Beam ×25" is on. */
export const BEAM_ZOOM_FACTOR = 25

/** Top of the glyph above the axis in pixels (used to place captions). */
export function glyphTop(component: BenchComponent, yScale: number): number {
  switch (component.kind) {
    case 'laser':
      return 20
    case 'tungsten':
      return 34
    case 'lens':
      return (component.aperture / 2) * yScale + 9
    case 'singleSlit':
    case 'doubleSlit':
      return SLIT_PLATE_HALF_HEIGHT * yScale + 4
    case 'object':
      return Math.max(component.height * yScale + 4, 14)
    case 'screen':
      return SCREEN_HALF_SIZE * yScale + 5
  }
}

/** How far the housing extends to the left of the optical plane, in pixels. */
export function glyphBodyLeft(component: BenchComponent): number {
  return component.kind === 'laser' ? 96 : component.kind === 'tungsten' ? 56 : 14
}
