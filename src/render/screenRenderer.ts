/**
 * Rasterises the light arriving at the screen (as computed by the physics
 * layer) into pixels. This module decides nothing about the optics: it maps
 * screen positions to the calculated irradiance and irradiance to brightness.
 */
import type { ScreenLight } from '../physics/optics'
import type { Rgb } from '../physics/spectrum'
import { fromMeters } from '../physics/units'
import { drawObjectShape } from './shapes'

export interface ScreenViewport {
  /** Internal canvas resolution (square). */
  size: number
  /** Physical width of the screen area shown. */
  fov: number
  /** Camera/eye exposure gain; 1 maps the nominal peak irradiance to full brightness. */
  exposure: number
}

const GAMMA_LUT = new Uint8ClampedArray(2049)
for (let i = 0; i <= 2048; i++) GAMMA_LUT[i] = Math.round(255 * Math.pow(i / 2048, 1 / 2.2))

/** Linear light -> display value, with highlights bleeding to white when over-exposed. */
function writePixel(data: Uint8ClampedArray, offset: number, r: number, g: number, b: number): void {
  const peak = Math.max(r, g, b)
  if (peak > 1) {
    const bleed = Math.min(1, 0.12 * (peak - 1))
    r += bleed
    g += bleed
    b += bleed
  }
  data[offset] = GAMMA_LUT[r <= 0 ? 0 : r >= 1 ? 2048 : (r * 2048) | 0]
  data[offset + 1] = GAMMA_LUT[g <= 0 ? 0 : g >= 1 ? 2048 : (g * 2048) | 0]
  data[offset + 2] = GAMMA_LUT[b <= 0 ? 0 : b >= 1 ? 2048 : (b * 2048) | 0]
  data[offset + 3] = 255
}

let scratch: HTMLCanvasElement | null = null
function scratchCanvas(width: number, height: number): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas')
  if (scratch.width !== width || scratch.height !== height) {
    scratch.width = width
    scratch.height = height
  }
  return scratch.getContext('2d', { willReadFrequently: true })!
}

let stage: HTMLCanvasElement | null = null
function stageCanvas(size: number): CanvasRenderingContext2D {
  stage ??= document.createElement('canvas')
  if (stage.width !== size || stage.height !== size) {
    stage.width = size
    stage.height = size
  }
  return stage.getContext('2d')!
}

export function renderScreen(ctx: CanvasRenderingContext2D, light: ScreenLight | null, viewport: ScreenViewport): void {
  const { size } = viewport
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  if (!light) return
  switch (light.kind) {
    case 'dark':
    case 'unsupported':
      return
    case 'uniform':
      renderUniform(ctx, light.rgb, light.level * viewport.exposure, size)
      return
    case 'spot':
      renderSpot(ctx, light, viewport)
      return
    case 'fringes':
      renderFringes(ctx, light, viewport)
      return
    case 'spots':
      renderSpots(ctx, light, viewport)
      return
    case 'image':
      renderImage(ctx, light, viewport)
      return
    case 'field':
      renderField(ctx, light, viewport)
      return
  }
}

function renderField(
  ctx: CanvasRenderingContext2D,
  light: Extract<ScreenLight, { kind: 'field' }>,
  { size, fov, exposure }: ScreenViewport,
): void {
  const pixel = fov / size
  const gain = (light.level * exposure) / 4
  const image = ctx.createImageData(size, size)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      // 2 × 2 samples per pixel, averaged in linear light, so fine fringes do not alias.
      let sum = 0
      for (let sy = 0; sy < 2; sy++) {
        const v = (size / 2 - row - 0.25 - 0.5 * sy) * pixel
        for (let sx = 0; sx < 2; sx++) {
          sum += light.intensity((column + 0.25 + 0.5 * sx - size / 2) * pixel, v)
        }
      }
      const value = sum * gain
      writePixel(image.data, 4 * (row * size + column), light.rgb[0] * value, light.rgb[1] * value, light.rgb[2] * value)
    }
  }
  ctx.putImageData(image, 0, 0)
}

function renderUniform(ctx: CanvasRenderingContext2D, rgb: Rgb, level: number, size: number): void {
  const image = ctx.createImageData(1, 1)
  writePixel(image.data, 0, rgb[0] * level, rgb[1] * level, rgb[2] * level)
  ctx.fillStyle = `rgb(${image.data[0]},${image.data[1]},${image.data[2]})`
  ctx.fillRect(0, 0, size, size)
}

function renderSpot(
  ctx: CanvasRenderingContext2D,
  light: Extract<ScreenLight, { kind: 'spot' }>,
  { size, fov, exposure }: ScreenViewport,
): void {
  const pixel = fov / size
  // A spot smaller than a pixel is spread over the pixel, conserving its power.
  const radius = Math.hypot(light.radius, 0.6 * pixel)
  const amplitude = light.level * exposure * (light.radius / radius) ** 2
  const image = ctx.createImageData(size, size)
  const profile = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const u = (i + 0.5 - size / 2) * pixel
    profile[i] = Math.exp((-2 * u * u) / (radius * radius))
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const value = amplitude * profile[i] * profile[j]
      writePixel(image.data, 4 * (j * size + i), light.rgb[0] * value, light.rgb[1] * value, light.rgb[2] * value)
    }
  }
  ctx.putImageData(image, 0, 0)
}

function renderSpots(
  ctx: CanvasRenderingContext2D,
  light: Extract<ScreenLight, { kind: 'spots' }>,
  { size, fov, exposure }: ScreenViewport,
): void {
  const pixel = fov / size
  const field = new Float32Array(size * size)
  const vertical = light.orientation === 'vertical'
  for (const spot of light.spots) {
    // A spot smaller than a pixel is spread over the pixel, conserving its power.
    const along = Math.hypot(spot.radiusAlong, 0.6 * pixel)
    const across = Math.hypot(spot.radiusAcross, 0.6 * pixel)
    const amplitude = spot.level * light.level * exposure * (spot.radiusAlong / along) * (spot.radiusAcross / across)
    // Index range in which the Gaussian is above 1e-8 of its peak.
    const p0 = Math.max(0, Math.floor((spot.position - 3 * along + fov / 2) / pixel))
    const p1 = Math.min(size - 1, Math.ceil((spot.position + 3 * along + fov / 2) / pixel))
    const q0 = Math.max(0, Math.floor((-3 * across + fov / 2) / pixel))
    const q1 = Math.min(size - 1, Math.ceil((3 * across + fov / 2) / pixel))
    for (let p = p0; p <= p1; p++) {
      const u = (p + 0.5 - size / 2) * pixel - spot.position
      const profile = amplitude * Math.exp((-2 * u * u) / (along * along))
      for (let q = q0; q <= q1; q++) {
        const t = (q + 0.5 - size / 2) * pixel
        // Vertical grating lines spread the orders horizontally; v increases upwards.
        const index = vertical ? q * size + p : (size - 1 - p) * size + q
        field[index] += profile * Math.exp((-2 * t * t) / (across * across))
      }
    }
  }
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const value = field[i]
    writePixel(image.data, 4 * i, light.rgb[0] * value, light.rgb[1] * value, light.rgb[2] * value)
  }
  ctx.putImageData(image, 0, 0)
}

const SUPERSAMPLE = 3

function renderFringes(
  ctx: CanvasRenderingContext2D,
  light: Extract<ScreenLight, { kind: 'fringes' }>,
  { size, fov, exposure }: ScreenViewport,
): void {
  const pixel = fov / size
  const step = pixel / SUPERSAMPLE
  // Several samples per pixel, averaged in linear light, so fine fringes do not alias.
  const samples = light.pattern.sample(-fov / 2 + step / 2, step, size * SUPERSAMPLE)
  const along = new Float32Array(size * 3)
  for (let i = 0; i < size; i++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let s = 0; s < SUPERSAMPLE; s++) sum += samples.rgb[3 * (i * SUPERSAMPLE + s) + c]
      along[3 * i + c] = (sum / SUPERSAMPLE) * exposure
    }
  }
  const across = new Float32Array(size)
  for (let j = 0; j < size; j++) {
    const t = Math.abs((j + 0.5 - size / 2) * pixel)
    if (light.band.profile === 'gaussian') {
      const radius = Math.max(light.band.radius, pixel)
      across[j] = Math.exp((-2 * t * t) / (radius * radius))
    } else {
      const { halfHeight, edge } = light.band
      const x = Math.min(1, Math.max(0, (halfHeight + edge / 2 - t) / edge))
      across[j] = x * x * (3 - 2 * x)
    }
  }
  const image = ctx.createImageData(size, size)
  const vertical = light.orientation === 'vertical'
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      // Vertical slits spread the light horizontally; v increases upwards.
      const p = vertical ? column : size - 1 - row
      const q = vertical ? row : column
      const weight = across[q]
      writePixel(image.data, 4 * (row * size + column), along[3 * p] * weight, along[3 * p + 1] * weight, along[3 * p + 2] * weight)
    }
  }
  ctx.putImageData(image, 0, 0)
}

const MAX_BLUR_RADIUS = 14

function renderImage(
  ctx: CanvasRenderingContext2D,
  light: Extract<ScreenLight, { kind: 'image' }>,
  { size, fov, exposure }: ScreenViewport,
): void {
  const pxPerMeter = size / fov
  const blurRadiusPx = (light.blurDiameter / 2) * pxPerMeter
  // Light from outside the visible area blurs into it: work on a padded field.
  const padding = Math.min(size, Math.ceil(blurRadiusPx))
  const full = size + 2 * padding
  const factor = Math.max(1, Math.ceil(blurRadiusPx / MAX_BLUR_RADIUS), Math.ceil(full / 560))
  const n = Math.ceil(full / factor)
  const scale = pxPerMeter / factor

  const work = scratchCanvas(n, n)
  work.setTransform(1, 0, 0, 1, 0, 0)
  work.fillStyle = '#000'
  work.fillRect(0, 0, n, n)
  // Physical screen coordinates: every object point (x, y) lands at scale·(x, y),
  // so a negative scale rotates the picture by 180° (inverted image).
  work.translate(n / 2, n / 2)
  work.scale(scale * light.scale, -scale * light.scale)
  work.fillStyle = '#fff'
  drawObjectShape(work, light.shape, light.objectHeight, light.letter, light.anchor)
  work.setTransform(1, 0, 0, 1, 0, 0)

  const source = work.getImageData(0, 0, n, n)
  let field: Float32Array = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) field[i] = source.data[4 * i] / 255

  if (light.illuminationRadius !== null) {
    const radius = Math.max(light.illuminationRadius * Math.abs(light.scale) * scale, 0.5)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const r2 = (i + 0.5 - n / 2) ** 2 + (j + 0.5 - n / 2) ** 2
        field[j * n + i] *= Math.exp((-2 * r2) / (radius * radius))
      }
    }
  }

  const radius = blurRadiusPx / factor
  if (radius > 0.6) field = discBlur(field, n, radius)

  const gain = light.level * exposure
  for (let i = 0; i < n * n; i++) {
    const value = field[i] * gain
    writePixel(source.data, 4 * i, light.rgb[0] * value, light.rgb[1] * value, light.rgb[2] * value)
  }
  work.putImageData(source, 0, 0)
  const offset = padding / factor
  const span = size / factor
  const out = stageCanvas(size)
  out.imageSmoothingEnabled = true
  out.imageSmoothingQuality = 'high'
  out.drawImage(work.canvas, offset, offset, span, span, 0, 0, size, size)
  ctx.drawImage(out.canvas, 0, 0)
}

/**
 * Convolution with a uniform disc (the geometric blur of a circular lens
 * aperture). Energy conserving. Runs row-wise on prefix sums: O(n² · r).
 */
function discBlur(field: Float32Array, n: number, radius: number): Float32Array {
  const prefix = new Float32Array(n * (n + 1))
  for (let j = 0; j < n; j++) {
    let sum = 0
    const base = j * (n + 1)
    prefix[base] = 0
    for (let i = 0; i < n; i++) {
      sum += field[j * n + i]
      prefix[base + i + 1] = sum
    }
  }
  const reach = Math.floor(radius)
  const halfWidths: number[] = []
  let area = 0
  for (let dy = -reach; dy <= reach; dy++) {
    const half = Math.sqrt(Math.max(0, radius * radius - dy * dy))
    halfWidths.push(half)
    area += 2 * half
  }
  const out = new Float32Array(n * n)
  // Integral of a row from 0 to t (pixel i covers [i, i+1)).
  const integral = (row: number, t: number): number => {
    if (t <= 0) return 0
    const base = row * (n + 1)
    if (t >= n) return prefix[base + n]
    const whole = t | 0
    return prefix[base + whole] + (t - whole) * field[row * n + whole]
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let k = 0; k < halfWidths.length; k++) {
        const row = j + k - reach
        if (row < 0 || row >= n) continue
        const half = halfWidths[k]
        sum += integral(row, i + 0.5 + half) - integral(row, i + 0.5 - half)
      }
      out[j * n + i] = sum / area
    }
  }
  return out
}

export interface IntensityProfile {
  /** Relative intensity at evenly spaced positions across the field of view. */
  values: Float32Array
  /** Direction on the screen along which the profile is taken. */
  axis: 'horizontal' | 'vertical'
}

/** Linear intensity cross-section through the centre of the pattern. */
export function intensityProfile(light: ScreenLight | null, fov: number, count: number): IntensityProfile | null {
  if (!light) return null
  const step = fov / count
  if (light.kind === 'fringes') {
    const { intensity } = light.pattern.sample(-fov / 2 + step / 2, step, count)
    return { values: intensity, axis: light.orientation === 'vertical' ? 'horizontal' : 'vertical' }
  }
  if (light.kind === 'spots') {
    const values = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const u = -fov / 2 + (i + 0.5) * step
      let sum = 0
      for (const spot of light.spots) {
        const offset = u - spot.position
        sum += spot.level * Math.exp((-2 * offset * offset) / (spot.radiusAlong * spot.radiusAlong))
      }
      values[i] = light.level * sum
    }
    return { values, axis: light.orientation === 'vertical' ? 'horizontal' : 'vertical' }
  }
  if (light.kind === 'field') {
    const values = new Float32Array(count)
    for (let i = 0; i < count; i++) values[i] = light.level * light.intensity(-fov / 2 + (i + 0.5) * step, 0)
    return { values, axis: 'horizontal' }
  }
  if (light.kind === 'spot') {
    const values = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const u = -fov / 2 + (i + 0.5) * step
      values[i] = light.level * Math.exp((-2 * u * u) / (light.radius * light.radius))
    }
    return { values, axis: 'horizontal' }
  }
  return null
}

/** A "nice" tick spacing (1, 2 or 5 × 10ⁿ) giving roughly `target` divisions. */
export function niceStep(span: number, target: number): number {
  const raw = span / target
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  const fraction = raw / power
  return (fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10) * power
}

/** Millimetre graticule drawn over the screen so that distances can be read off. */
export function drawGraticule(ctx: CanvasRenderingContext2D, { size, fov }: ScreenViewport): void {
  const step = niceStep(fov, 8)
  const pxPerMeter = size / fov
  const digits = fromMeters(step, 'mm') < 1 ? (fromMeters(step, 'mm') < 0.1 ? 2 : 1) : 0
  ctx.save()
  ctx.lineWidth = 1
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(190, 205, 220, 0.75)'
  ctx.strokeStyle = 'rgba(160, 180, 200, 0.16)'
  ctx.beginPath()
  ctx.moveTo(size / 2 + 0.5, 0)
  ctx.lineTo(size / 2 + 0.5, size)
  ctx.moveTo(0, size / 2 + 0.5)
  ctx.lineTo(size, size / 2 + 0.5)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(190, 205, 220, 0.6)'
  ctx.beginPath()
  const count = Math.floor(fov / 2 / step)
  for (let k = -count; k <= count; k++) {
    const p = Math.round(size / 2 + k * step * pxPerMeter) + 0.5
    ctx.moveTo(p, size)
    ctx.lineTo(p, size - 7)
    ctx.moveTo(0, p)
    ctx.lineTo(7, p)
    const label = fromMeters(k * step, 'mm').toFixed(digits)
    // Keep labels clear of the corners.
    if ((k % 2 === 0 || count < 5) && p > 34 && p < size - 30) {
      ctx.textAlign = 'center'
      ctx.fillText(label, p, size - 11)
      ctx.textAlign = 'left'
      if (k !== 0) ctx.fillText(fromMeters(-k * step, 'mm').toFixed(digits), 11, p + 4)
    }
  }
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.fillText('mm', size - 6, size - 24)
  ctx.restore()
}
