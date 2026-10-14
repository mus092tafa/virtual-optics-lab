/**
 * Convolution of a picture with the light that one object point leaves on the
 * retina (its point spread): an ellipse, or several patches of different
 * colour and shape. Nothing here decides the size or the shape of the patches;
 * they come from the eye solver in metres and are only rasterised.
 *
 * Directions are those seen facing the eye, on a grid whose y runs downwards:
 * that is the picture the eye itself sees (mirrored left to right, and y
 * reversed, which together leave the direction of a line as it is).
 */
import type { SpreadComponent, SpreadShape } from '../physics/eye'

/** Below this size, in pixels, a patch no longer changes the picture. */
export const MIN_BLUR_RADIUS = 0.6
/** A patch is never rasterised thinner than this half-width: one pixel in all. */
const MIN_HALF_WIDTH = 0.5
/** Rings of the point spread are rasterised at least this wide. */
const MIN_RING_WIDTH = 0.25

/** The largest distance from the axis that the light of an object point reaches. */
export function reachOf(pointSpread: readonly SpreadComponent[]): number {
  let reach = 0
  for (const { shape } of pointSpread) reach = Math.max(reach, shape.kind === 'ellipse' ? shape.major : Math.max(0, ...shape.radii))
  return reach
}

/** A point spread that is one uniform ellipse, the same in every colour; null otherwise. */
export function singleEllipse(pointSpread: readonly SpreadComponent[]): (SpreadShape & { kind: 'ellipse' }) | null {
  return pointSpread.length === 1 && pointSpread[0].shape.kind === 'ellipse' && pointSpread[0].energy === 1 ? pointSpread[0].shape : null
}

/** The part of the row at the height y that an ellipse covers, as centre and half-width; null when the row misses it. */
function ellipseSpan(major: number, minor: number, angle: number, y: number): [centre: number, half: number] | null {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const a2 = 1 / (major * major)
  const b2 = 1 / (minor * minor)
  // (x c + y s)²/a² + (−x s + y c)²/b² = 1 as A x² + B x + C = 0.
  const A = c * c * a2 + s * s * b2
  const B = 2 * y * c * s * (a2 - b2)
  const C = y * y * (s * s * a2 + c * c * b2) - 1
  const discriminant = B * B - 4 * A * C
  return discriminant <= 0 ? null : [-B / (2 * A), Math.sqrt(discriminant) / (2 * A)]
}

/**
 * Convolution with a uniform ellipse of the given semi-axes (in pixels), the larger at the angle. Energy conserving.
 * Runs row-wise on prefix sums like the disc blur of the screen, which it equals for a circle.
 */
export function ellipseBlur(field: Float32Array, n: number, major: number, minor: number, angle: number): Float32Array {
  const a = Math.max(major, MIN_HALF_WIDTH)
  const b = Math.max(minor, MIN_HALF_WIDTH)
  const prefix = new Float32Array(n * (n + 1))
  for (let j = 0; j < n; j++) {
    let sum = 0
    const base = j * (n + 1)
    for (let i = 0; i < n; i++) {
      sum += field[j * n + i]
      prefix[base + i + 1] = sum
    }
  }
  // Rows the ellipse reaches: its half-height is √(a² sin² + b² cos²).
  const reach = Math.floor(Math.hypot(a * Math.sin(angle), b * Math.cos(angle)))
  const spans: ([number, number] | null)[] = []
  let area = 0
  for (let dy = -reach; dy <= reach; dy++) {
    const span = ellipseSpan(a, b, angle, dy)
    spans.push(span)
    if (span) area += 2 * span[1]
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
      for (let k = 0; k < spans.length; k++) {
        const span = spans[k]
        // The light of a pixel at (i − x, j − dy) reaches (i, j): the kernel is point-symmetric, so its rows can be read directly.
        const row = j + k - reach
        if (!span || row < 0 || row >= n) continue
        sum += integral(row, i + 0.5 + span[0] + span[1]) - integral(row, i + 0.5 + span[0] - span[1])
      }
      out[j * n + i] = sum / area
    }
  }
  return out
}

/** Rows each pixel is divided into when a patch is rasterised. */
const SUB_ROWS = 4

/** Adds the area that the span [from, to] covers of each pixel of a kernel row (pixel i is centred on i − half). */
function addSpan(kernel: Float64Array, size: number, row: number, from: number, to: number, weight: number): void {
  const half = (size - 1) / 2
  const first = Math.max(0, Math.floor(from + half + 0.5))
  const last = Math.min(size - 1, Math.floor(to + half + 0.5))
  for (let i = first; i <= last; i++) {
    const covered = Math.min(to, i - half + 0.5) - Math.max(from, i - half - 0.5)
    if (covered > 0) kernel[row * size + i] += weight * covered
  }
}

/** One patch of unit energy on a kernel grid of the given odd size, by the area it covers of each pixel. */
function rasterise(size: number, spanAt: (y: number) => [number, number][]): Float64Array {
  const kernel = new Float64Array(size * size)
  const half = (size - 1) / 2
  for (let row = 0; row < size; row++) {
    for (let sub = 0; sub < SUB_ROWS; sub++) {
      const y = row - half - 0.5 + (sub + 0.5) / SUB_ROWS
      for (const [from, to] of spanAt(y)) addSpan(kernel, size, row, from, to, 1)
    }
  }
  let total = 0
  for (let i = 0; i < kernel.length; i++) total += kernel[i]
  if (total > 0) for (let i = 0; i < kernel.length; i++) kernel[i] /= total
  return kernel
}

/** A ring between two radii as the spans of a row: the outer disc without the inner one. */
function ringSpans(inner: number, outer: number, y: number): [number, number][] {
  if (Math.abs(y) >= outer) return []
  const reach = Math.sqrt(outer * outer - y * y)
  if (Math.abs(y) >= inner) return [[-reach, reach]]
  const hole = Math.sqrt(inner * inner - y * y)
  return [
    [-reach, -hole],
    [hole, reach],
  ]
}

export interface Kernels {
  /** Odd side of each kernel. */
  size: number
  /** One kernel per colour channel; over a channel the values add up to the light of that colour. */
  channels: [Float64Array, Float64Array, Float64Array]
}

/** The point spread as three kernels, one pixel being 1/pxPerMeter. */
export function spreadKernels(pointSpread: readonly SpreadComponent[], pxPerMeter: number): Kernels {
  const size = 2 * Math.ceil(reachOf(pointSpread) * pxPerMeter + 1) + 1
  const channels: Kernels['channels'] = [new Float64Array(size * size), new Float64Array(size * size), new Float64Array(size * size)]
  const centre = ((size - 1) / 2) * (size + 1)
  const add = (patch: Float64Array | null, share: number, rgb: readonly number[]) => {
    for (let channel = 0; channel < 3; channel++) {
      const weight = share * rgb[channel]
      if (!patch) channels[channel][centre] += weight
      else for (let i = 0; i < patch.length; i++) channels[channel][i] += weight * patch[i]
    }
  }
  for (const component of pointSpread) {
    const { shape } = component
    if (shape.kind === 'ellipse') {
      const major = shape.major * pxPerMeter
      const minor = shape.minor * pxPerMeter
      // A patch smaller than a pixel is a point.
      if (major < MIN_BLUR_RADIUS) add(null, component.energy, component.rgb)
      else {
        const a = Math.max(major, MIN_HALF_WIDTH)
        const b = Math.max(minor, MIN_HALF_WIDTH)
        add(
          rasterise(size, (y) => {
            const span = ellipseSpan(a, b, shape.angle, y)
            return span ? [[span[0] - span[1], span[0] + span[1]]] : []
          }),
          component.energy,
          component.rgb,
        )
      }
      continue
    }
    const zones = shape.radii.length - 1
    for (let zone = 0; zone < zones; zone++) {
      let inner = Math.min(shape.radii[zone], shape.radii[zone + 1]) * pxPerMeter
      let outer = Math.max(shape.radii[zone], shape.radii[zone + 1]) * pxPerMeter
      if (outer < MIN_BLUR_RADIUS) {
        add(null, component.energy / zones, component.rgb)
        continue
      }
      // A ring too thin for the sub-rows to catch is given a width they can.
      if (outer - inner < MIN_RING_WIDTH) {
        const middle = (inner + outer) / 2
        inner = Math.max(0, middle - MIN_RING_WIDTH / 2)
        outer = middle + MIN_RING_WIDTH / 2
      }
      add(
        rasterise(size, (y) => ringSpans(inner, outer, y)),
        component.energy / zones,
        component.rgb,
      )
    }
  }
  return { size, channels }
}

/** cos and sin of 2πk/n for the butterflies of a transform of length n. */
function twiddles(n: number): { cos: Float64Array; sin: Float64Array } {
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let k = 0; k < n / 2; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / n)
    sin[k] = Math.sin((2 * Math.PI * k) / n)
  }
  return { cos, sin }
}

/** In-place radix-2 Fourier transform of the n complex values that start at an offset; n is a power of two. */
function fft(re: Float64Array, im: Float64Array, offset: number, n: number, inverse: boolean, table: { cos: Float64Array; sin: Float64Array }): void {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const a = offset + i
      const b = offset + j
      let t = re[a]
      re[a] = re[b]
      re[b] = t
      t = im[a]
      im[a] = im[b]
      im[b] = t
    }
  }
  const sign = inverse ? 1 : -1
  for (let length = 2; length <= n; length <<= 1) {
    const half = length >> 1
    const step = n / length
    for (let start = offset; start < offset + n; start += length) {
      for (let k = 0; k < half; k++) {
        const wRe = table.cos[k * step]
        const wIm = sign * table.sin[k * step]
        const a = start + k
        const b = a + half
        const tRe = re[b] * wRe - im[b] * wIm
        const tIm = re[b] * wIm + im[b] * wRe
        re[b] = re[a] - tRe
        im[b] = im[a] - tIm
        re[a] += tRe
        im[a] += tIm
      }
    }
  }
}

function fft2d(re: Float64Array, im: Float64Array, n: number, inverse: boolean): void {
  const table = twiddles(n)
  for (let row = 0; row < n; row++) fft(re, im, row * n, n, inverse, table)
  // A column is copied out and back: stepping through the grid by whole rows is slow.
  const columnRe = new Float64Array(n)
  const columnIm = new Float64Array(n)
  for (let column = 0; column < n; column++) {
    for (let row = 0; row < n; row++) {
      columnRe[row] = re[row * n + column]
      columnIm[row] = im[row * n + column]
    }
    fft(columnRe, columnIm, 0, n, inverse, table)
    for (let row = 0; row < n; row++) {
      re[row * n + column] = columnRe[row]
      im[row * n + column] = columnIm[row]
    }
  }
  if (inverse) {
    const scale = 1 / (n * n)
    for (let i = 0; i < re.length; i++) {
      re[i] *= scale
      im[i] *= scale
    }
  }
}

/**
 * The field convolved with each of the three kernels, by Fourier transform. n must be a power of two; the field is
 * taken as periodic, so the caller keeps a margin as wide as the kernel's reach around the part it uses.
 */
export function convolveKernels(field: Float32Array, n: number, kernels: Kernels): [Float32Array, Float32Array, Float32Array] {
  const fieldRe = Float64Array.from(field)
  const fieldIm = new Float64Array(n * n)
  fft2d(fieldRe, fieldIm, n, false)
  const half = (kernels.size - 1) / 2
  /** Two real kernels as the real and the imaginary part of one transform: their convolutions come back the same way. */
  const pair = (first: Float64Array, second: Float64Array | null): [Float32Array, Float32Array] => {
    const re = new Float64Array(n * n)
    const im = new Float64Array(n * n)
    for (let j = 0; j < kernels.size; j++) {
      // The kernel's centre goes to the origin; the rest wraps around.
      const row = ((j - half + n) % n) * n
      for (let i = 0; i < kernels.size; i++) {
        const index = row + ((i - half + n) % n)
        re[index] += first[j * kernels.size + i]
        if (second) im[index] += second[j * kernels.size + i]
      }
    }
    fft2d(re, im, n, false)
    for (let i = 0; i < re.length; i++) {
      const a = re[i] * fieldRe[i] - im[i] * fieldIm[i]
      im[i] = re[i] * fieldIm[i] + im[i] * fieldRe[i]
      re[i] = a
    }
    fft2d(re, im, n, true)
    return [Float32Array.from(re), Float32Array.from(im)]
  }
  const [red, green, blue] = kernels.channels
  const same = (a: Float64Array, b: Float64Array) => a.every((value, i) => value === b[i])
  // Light of one colour mixture in every channel (a white point spread) needs one convolution.
  if (same(red, green) && same(red, blue)) {
    const [all] = pair(red, null)
    return [all, all, all]
  }
  const [first, second] = pair(red, green)
  return [first, second, pair(blue, null)[0]]
}
