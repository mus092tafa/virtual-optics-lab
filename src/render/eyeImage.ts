/**
 * Draws the test chart as the eye images it on the retina: the chart at its
 * retinal size, convolved with the light of one object point that the
 * physics layer calculated. Nothing here decides how blurred the image is.
 */
import type { Mat2 } from '../physics/astigmatism'
import { LETTER_STROKES } from '../physics/constants'
import type { SpreadComponent } from '../physics/eye'
import type { EyeChart } from '../state/presets'
import { MIN_BLUR_RADIUS, convolveKernels, ellipseBlur, reachOf, singleEllipse, spreadKernels } from './pointSpread'
import { discBlur } from './screenRenderer'

export interface RetinalImage {
  chart: EyeChart
  /** The chart, in letter heights, to the retina in metres, as it is seen. */
  letterScale: Mat2
  /** The light of one object point on the retina. */
  pointSpread: readonly SpreadComponent[]
  /** Brightness relative to the widest pupil. */
  illuminance: number
  /** Width of the part of the retina shown. */
  fieldOfView: number
}

/** Blur radii above this many pixels are computed on a coarser grid. */
const MAX_BLUR_RADIUS = 48
/** Largest grid, a power of two, on which a picture is convolved by Fourier transform. */
const MAX_FFT_GRID = 512
/** Meridians of the fan chart, in degrees as seen facing the eye. */
export const FAN_MERIDIANS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]

/** The field convolved with a uniform disc; unchanged when the disc is smaller than a pixel. Energy conserving. */
export function blurField(field: Float32Array, n: number, radius: number): Float32Array {
  return radius > MIN_BLUR_RADIUS ? discBlur(field, n, radius) : field
}

/** Directions of the open side of the tumbling E, row by row (0: right, 1: down, 2: left, 3: up). */
const LETTER_ROWS: { size: number; turns: number[] }[] = [
  { size: 3, turns: [0, 3, 2] },
  { size: 2, turns: [1, 0, 2, 3] },
  { size: 1, turns: [2, 1, 3, 0, 1, 2] },
]

/** A letter E of unit height with strokes one fifth of it, centred on the origin and turned by quarter turns. */
function tumblingE(ctx: CanvasRenderingContext2D, turns: number): void {
  const stroke = 1 / LETTER_STROKES
  ctx.save()
  ctx.rotate((turns * Math.PI) / 2)
  ctx.fillRect(-0.5, -0.5, stroke, 1)
  for (const bar of [0, 2, 4]) ctx.fillRect(-0.5, -0.5 + bar * stroke, 1, stroke)
  ctx.restore()
}

const TEXT_LINES = ['Light from a point', 'of the page must', 'meet in one point', 'on the retina.']
/** Capital height of the text face as a fraction of the font size. */
const CAP_HEIGHT = 0.72

/**
 * Draws a chart in black on white, in units of the letter height, centred on
 * the origin with y pointing down.
 */
function drawChart(ctx: CanvasRenderingContext2D, chart: EyeChart): void {
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  switch (chart) {
    case 'letters': {
      const gap = 1
      const total = LETTER_ROWS.reduce((sum, row) => sum + row.size, 0) + gap * (LETTER_ROWS.length - 1)
      let y = -total / 2
      for (const row of LETTER_ROWS) {
        const width = row.size * (2 * row.turns.length - 1)
        row.turns.forEach((turns, index) => {
          ctx.save()
          ctx.translate(-width / 2 + row.size * (2 * index + 0.5), y + row.size / 2)
          ctx.scale(row.size, row.size)
          tumblingE(ctx, turns)
          ctx.restore()
        })
        y += row.size + gap
      }
      break
    }
    case 'text': {
      ctx.font = `600 ${1 / CAP_HEIGHT}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      const pitch = 2.2
      TEXT_LINES.forEach((line, index) => ctx.fillText(line, 0, (index - (TEXT_LINES.length - 1) / 2) * pitch + 0.5))
      break
    }
    case 'fan': {
      // One line along each meridian, with a gap at the centre where they would run together. A line along the
      // meridian θ points to (cos θ, sin θ) on this grid, whose y runs downwards: that is where the eye sees it.
      ctx.lineWidth = 1 / LETTER_STROKES
      ctx.lineCap = 'butt'
      ctx.font = '0.85px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const meridian of FAN_MERIDIANS) {
        const angle = (meridian * Math.PI) / 180
        const along = [Math.cos(angle), Math.sin(angle)]
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.moveTo(side * 1.3 * along[0], side * 1.3 * along[1])
          ctx.lineTo(side * 4.4 * along[0], side * 4.4 * along[1])
          ctx.stroke()
        }
        // The number stands at the upper end of its line, 180 at the left: the examiner's scale as the eye sees it.
        if (meridian % 30 === 0) ctx.fillText(String(meridian === 0 ? 180 : meridian), -5.3 * along[0], -5.3 * along[1])
      }
      break
    }
    case 'face': {
      // A schematic face eight letters high, drawn with strokes of the letters' stroke width.
      ctx.lineWidth = 1 / LETTER_STROKES
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.ellipse(0, 0, 3.2, 4, 0, 0, 2 * Math.PI)
      ctx.stroke()
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(side * 1.25, -0.9, 0.34, 0, 2 * Math.PI)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(side * 0.75, -1.75)
        ctx.lineTo(side * 1.8, -1.9)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, -0.5)
      ctx.lineTo(-0.35, 0.75)
      ctx.lineTo(0.2, 0.8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 1.2, 1.5, 0.2 * Math.PI, 0.8 * Math.PI)
      ctx.stroke()
      break
    }
  }
}

let scratch: HTMLCanvasElement | null = null
function scratchCanvas(size: number): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas')
  if (scratch.width !== size || scratch.height !== size) {
    scratch.width = size
    scratch.height = size
  }
  return scratch.getContext('2d', { willReadFrequently: true })!
}

const nextPowerOfTwo = (value: number) => 2 ** Math.ceil(Math.log2(value))

/**
 * Paints the retinal image into a square canvas. The image is shown the way
 * the eye sees it, upright, although it is inverted on the retina.
 */
export function renderRetinalImage(ctx: CanvasRenderingContext2D, image: RetinalImage, size: number): void {
  const pxPerMeter = size / image.fieldOfView
  const reach = reachOf(image.pointSpread) * pxPerMeter
  const ellipse = singleEllipse(image.pointSpread)
  // Light from outside the visible field blurs into it: work on a padded, possibly coarser, field.
  let factor: number
  let n: number
  let padding: number
  if (ellipse) {
    padding = Math.min(size, Math.ceil(reach))
    factor = Math.max(1, Math.ceil(reach / MAX_BLUR_RADIUS))
    n = Math.ceil((size + 2 * padding) / factor)
    padding /= factor
  } else {
    // The transform needs a power of two, and takes the field as periodic: the margin keeps the wrap out of the picture.
    factor = 1
    const side = () => nextPowerOfTwo(Math.ceil(size / factor) + 2 * Math.ceil(Math.min(size, reach) / factor + 2))
    while (side() > MAX_FFT_GRID) factor++
    n = side()
    padding = (n - size / factor) / 2
  }

  const work = scratchCanvas(n)
  work.setTransform(1, 0, 0, 1, 0, 0)
  work.fillStyle = '#fff'
  work.fillRect(0, 0, n, n)
  const unit = pxPerMeter / factor
  const [a, b, c, d] = image.letterScale
  // The scale matrix holds the directions seen facing the eye; on a grid with y downwards it draws the eye's own view.
  work.setTransform(a * unit, c * unit, b * unit, d * unit, n / 2, n / 2)
  drawChart(work, image.chart)
  work.setTransform(1, 0, 0, 1, 0, 0)

  const pixels = work.getImageData(0, 0, n, n)
  const field = new Float32Array(n * n)
  // The chart is drawn in grey levels, so one channel carries the whole picture.
  for (let i = 0; i < field.length; i++) field[i] = pixels.data[4 * i] / 255

  let channels: [Float32Array, Float32Array, Float32Array]
  let weights: readonly number[] = [1, 1, 1]
  if (ellipse) {
    const major = (ellipse.major * pxPerMeter) / factor
    const minor = (ellipse.minor * pxPerMeter) / factor
    // A circle takes the disc blur of the screen; a patch smaller than a pixel changes nothing.
    const blurred = major - minor < 1e-6 ? blurField(field, n, major) : major <= MIN_BLUR_RADIUS ? field : ellipseBlur(field, n, major, minor, ellipse.angle)
    channels = [blurred, blurred, blurred]
    weights = image.pointSpread[0].rgb
  } else {
    channels = convolveKernels(field, n, spreadKernels(image.pointSpread, pxPerMeter / factor))
  }

  const gain = image.illuminance
  for (let i = 0; i < field.length; i++) {
    for (let channel = 0; channel < 3; channel++) {
      pixels.data[4 * i + channel] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, channels[channel][i] * weights[channel] * gain)), 1 / 2.2))
    }
    pixels.data[4 * i + 3] = 255
  }
  work.putImageData(pixels, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(work.canvas, padding, padding, size / factor, size / factor, 0, 0, size, size)
}
