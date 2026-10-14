import { describe, expect, it } from 'vitest'
import type { SpreadComponent, SpreadShape } from '../../physics/eye'
import { convolveKernels, ellipseBlur, reachOf, singleEllipse, spreadKernels } from '../pointSpread'
import { discBlur } from '../screenRenderer'

const N = 64

const total = (field: ArrayLike<number>) => Array.from(field).reduce((sum, value) => sum + value, 0)
const component = (shape: SpreadShape, rgb: readonly [number, number, number] = [1, 1, 1], energy = 1): SpreadComponent => ({ rgb, luminance: 1, energy, shape })

/** A bright square in the middle of a dark field. */
function square(): Float32Array {
  const field = new Float32Array(N * N)
  for (let j = 28; j < 36; j++) for (let i = 28; i < 36; i++) field[j * N + i] = 1
  return field
}

/** A line one pixel wide through the centre along the meridian θ: towards (cos θ, sin θ) with y running down the grid. */
function line(degrees: number): Float32Array {
  const field = new Float32Array(N * N)
  const angle = (degrees * Math.PI) / 180
  for (let t = -20; t <= 20; t += 0.25) field[Math.round(32 + t * Math.sin(angle)) * N + Math.round(32 + t * Math.cos(angle))] = 1
  return field
}

describe('blur with an ellipse', () => {
  it('is the disc blur of the screen for a circle', () => {
    const field = square()
    const disc = discBlur(field, N, 7.3)
    const circle = ellipseBlur(field, N, 7.3, 7.3, 0.4)
    for (let i = 0; i < disc.length; i++) expect(circle[i]).toBeCloseTo(disc[i], 5)
  })

  it('neither adds nor loses light', () => {
    const field = square()
    expect(total(ellipseBlur(field, N, 11, 3, 0.7))).toBeCloseTo(total(field), 2)
    expect(total(ellipseBlur(field, N, 9, 0, Math.PI / 2))).toBeCloseTo(total(field), 2)
  })

  it('spreads the light along its larger axis only', () => {
    const blurred = ellipseBlur(square(), N, 10, 0, 0)
    // Horizontal: light reaches 10 pixels to the side of the square and not above it.
    expect(blurred[32 * N + 43]).toBeGreaterThan(0)
    expect(blurred[24 * N + 32]).toBe(0)
    const turned = ellipseBlur(square(), N, 10, 0, Math.PI / 2)
    expect(turned[43 * N + 32]).toBeGreaterThan(0)
    expect(turned[32 * N + 24]).toBe(0)
  })

  it('keeps the line along a vertical focal line sharp and blurs the one across it', () => {
    // A focal line on the retina along the 90° meridian: the fan's line labelled 90 lies along it.
    const blur = (degrees: number) => Math.max(...ellipseBlur(line(degrees), N, 8, 0, Math.PI / 2))
    expect(blur(90)).toBeCloseTo(1, 5)
    expect(blur(0)).toBeLessThan(0.1)
    expect(blur(60)).toBeGreaterThan(blur(30))
  })

  it('follows an oblique focal line the same way', () => {
    const blur = (degrees: number) => Math.max(...ellipseBlur(line(degrees), N, 8, 0, Math.PI / 4))
    expect(blur(45)).toBeGreaterThan(3 * blur(135))
  })
})

describe('the point spread as kernels', () => {
  const disc = component({ kind: 'ellipse', major: 7, minor: 7, angle: 0 })

  it('knows a single ellipse from a mixture', () => {
    expect(singleEllipse([disc])).not.toBeNull()
    expect(singleEllipse([disc, disc])).toBeNull()
    expect(singleEllipse([component({ kind: 'rings', radii: [0, 1, 2] })])).toBeNull()
    expect(reachOf([disc, component({ kind: 'rings', radii: [0, 3, 9, 4] })])).toBe(9)
  })

  it('holds the light of each colour', () => {
    const kernels = spreadKernels([component({ kind: 'ellipse', major: 6, minor: 2, angle: 1 }, [0.2, 0.5, 0.3]), component({ kind: 'rings', radii: [0, 2, 3, 5] }, [0.8, 0.5, 0.7], 0.5)], 1)
    expect(total(kernels.channels[0])).toBeCloseTo(0.2 + 0.4, 9)
    expect(total(kernels.channels[1])).toBeCloseTo(0.5 + 0.25, 9)
    expect(total(kernels.channels[2])).toBeCloseTo(0.3 + 0.35, 9)
  })

  it('gives rings of equal energy that fill a disc the kernel of that disc', () => {
    const radii = Array.from({ length: 13 }, (_, i) => 9 * Math.sqrt(i / 12))
    const rings = spreadKernels([component({ kind: 'rings', radii })], 1).channels[0]
    const whole = spreadKernels([component({ kind: 'ellipse', major: 9, minor: 9, angle: 0 })], 1).channels[0]
    for (let i = 0; i < whole.length; i++) expect(rings[i]).toBeCloseTo(whole[i], 3)
  })

  it('convolves like the disc blur', () => {
    const field = square()
    const [red, green, blue] = convolveKernels(field, N, spreadKernels([disc], 1))
    const reference = discBlur(field, N, 7)
    expect(green).toBe(red)
    expect(blue).toBe(red)
    // The disc blur samples each row at its centre, the kernel by covered area: they differ at the rim only.
    for (let i = 0; i < reference.length; i++) expect(Math.abs(red[i] - reference[i])).toBeLessThan(0.02)
    expect(total(red)).toBeCloseTo(total(field), 4)
  })

  it('leaves a white chart white when every colour is in focus', () => {
    const field = square()
    const point: SpreadShape = { kind: 'ellipse', major: 0, minor: 0, angle: 0 }
    const channels = convolveKernels(field, N, spreadKernels([component(point, [0.5, 0.2, 0.1]), component(point, [0.3, 0.3, 0.2]), component(point, [0.2, 0.5, 0.7])], 1))
    for (const channel of channels) for (let i = 0; i < field.length; i++) expect(channel[i]).toBeCloseTo(field[i], 9)
  })

  it('colours the edge when one colour is out of focus', () => {
    const field = square()
    const sharp: SpreadShape = { kind: 'ellipse', major: 0, minor: 0, angle: 0 }
    const [red, , blue] = convolveKernels(field, N, spreadKernels([component(sharp, [1, 1, 0]), component({ kind: 'ellipse', major: 5, minor: 5, angle: 0 }, [0, 0, 1])], 1))
    // Just outside the square there is blue light and no red; each colour keeps its total.
    expect(red[32 * N + 38]).toBeCloseTo(0, 9)
    expect(blue[32 * N + 38]).toBeGreaterThan(0.1)
    expect(total(blue)).toBeCloseTo(total(red), 4)
  })
})
