import type { LuminousShape } from '../physics/optics'

/**
 * Draws a luminous object into a canvas whose coordinate system is physical:
 * metres, y pointing up, origin on the optical axis.
 * 'base' objects stand on the axis (0..height); 'center' ones are centred on it.
 */
export function drawObjectShape(
  ctx: CanvasRenderingContext2D,
  shape: LuminousShape,
  height: number,
  letter: string,
  anchor: 'base' | 'center',
): void {
  const h = height
  ctx.save()
  if (anchor === 'center') ctx.translate(0, -h / 2)
  ctx.beginPath()
  switch (shape) {
    case 'arrow': {
      const shaft = 0.07 * h
      const head = 0.24 * h
      const neck = 0.62 * h
      ctx.moveTo(-shaft, 0)
      ctx.lineTo(shaft, 0)
      ctx.lineTo(shaft, neck)
      ctx.lineTo(head, neck)
      ctx.lineTo(0, h)
      ctx.lineTo(-head, neck)
      ctx.lineTo(-shaft, neck)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'rectangle':
      ctx.fillRect(-0.3 * h, 0, 0.6 * h, h)
      break
    case 'circle':
    case 'disc':
      ctx.arc(0, h / 2, h / 2, 0, 2 * Math.PI)
      ctx.fill()
      break
    case 'cross': {
      // An asymmetric cross so that inversion is visible.
      const t = 0.09 * h
      ctx.fillRect(-t, 0, 2 * t, h)
      ctx.fillRect(-0.32 * h, 0.66 * h - t, 0.64 * h, 2 * t)
      ctx.fillRect(0, 0.2 * h - t * 0.8, 0.3 * h, 1.6 * t)
      break
    }
    case 'letter': {
      // Text is laid out in a y-down system: flip locally and fit the glyph's
      // ink box to the object height.
      const glyph = (letter || 'F').slice(0, 1)
      const reference = 100
      ctx.scale(h / reference, -h / reference)
      ctx.font = `bold ${reference}px "Helvetica Neue", Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      const metrics = ctx.measureText(glyph)
      const ascent = metrics.actualBoundingBoxAscent || reference * 0.72
      const left = metrics.actualBoundingBoxLeft || 0
      const right = metrics.actualBoundingBoxRight || metrics.width
      const fit = reference / ascent
      ctx.scale(fit, fit)
      ctx.fillText(glyph, (left - right) / 2, 0)
      break
    }
  }
  ctx.restore()
}
