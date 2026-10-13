/**
 * Draws the test chart as the eye images it on the retina: the chart at its
 * retinal size, convolved with the blur disc the physics layer calculated.
 * Nothing here decides how blurred the image is.
 */
import { LETTER_STROKES } from '../physics/constants'
import type { EyeChart } from '../state/presets'
import { discBlur } from './screenRenderer'

export interface RetinalImage {
  chart: EyeChart
  /** Height of one letter on the retina. */
  letterHeight: number
  blurDiameter: number
  /** Brightness relative to the widest pupil. */
  illuminance: number
  /** Width of the part of the retina shown. */
  fieldOfView: number
}

/** Blur radii above this many pixels are computed on a coarser grid. */
const MAX_BLUR_RADIUS = 48
/** Below this radius, in pixels, a disc no longer changes the picture. */
const MIN_BLUR_RADIUS = 0.6

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

/**
 * Paints the retinal image into a square canvas. The image is shown the way
 * it is seen, upright, although it is inverted on the retina.
 */
export function renderRetinalImage(ctx: CanvasRenderingContext2D, image: RetinalImage, size: number): void {
  const pxPerMeter = size / image.fieldOfView
  const radius = (image.blurDiameter / 2) * pxPerMeter
  // Light from outside the visible field blurs into it: work on a padded, possibly coarser, field.
  const padding = Math.min(size, Math.ceil(radius))
  const factor = Math.max(1, Math.ceil(radius / MAX_BLUR_RADIUS))
  const n = Math.ceil((size + 2 * padding) / factor)

  const work = scratchCanvas(n)
  work.setTransform(1, 0, 0, 1, 0, 0)
  work.fillStyle = '#fff'
  work.fillRect(0, 0, n, n)
  const unit = (image.letterHeight * pxPerMeter) / factor
  work.setTransform(unit, 0, 0, unit, n / 2, n / 2)
  drawChart(work, image.chart)
  work.setTransform(1, 0, 0, 1, 0, 0)

  const pixels = work.getImageData(0, 0, n, n)
  let field = new Float32Array(n * n)
  // The chart is drawn in grey levels, so one channel carries the whole picture.
  for (let i = 0; i < field.length; i++) field[i] = pixels.data[4 * i] / 255
  field = blurField(field, n, radius / factor) as Float32Array<ArrayBuffer>

  const gain = image.illuminance
  for (let i = 0; i < field.length; i++) {
    const value = Math.round(255 * Math.pow(Math.min(1, Math.max(0, field[i] * gain)), 1 / 2.2))
    pixels.data[4 * i] = value
    pixels.data[4 * i + 1] = value
    pixels.data[4 * i + 2] = value
    pixels.data[4 * i + 3] = 255
  }
  work.putImageData(pixels, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(work.canvas, padding / factor, padding / factor, size / factor, size / factor, 0, 0, size, size)
}
