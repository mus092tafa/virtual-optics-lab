import { describe, expect, it } from 'vitest'
import { blurField } from '../eyeImage'

const N = 64

/** A bright square in the middle of a dark field. */
function square(): Float32Array {
  const field = new Float32Array(N * N)
  for (let j = 28; j < 36; j++) for (let i = 28; i < 36; i++) field[j * N + i] = 1
  return field
}

const total = (field: Float32Array) => field.reduce((sum, value) => sum + value, 0)

describe('blur of the retinal image', () => {
  it('leaves an image in focus unchanged', () => {
    const field = square()
    expect(blurField(field, N, 0)).toBe(field)
  })

  it('spreads the light without adding or losing any', () => {
    const field = square()
    const blurred = blurField(field, N, 9)
    expect(total(blurred)).toBeCloseTo(total(field), 2)
    expect(Math.max(...blurred)).toBeLessThan(1)
    // The light reaches as far as the disc's radius beyond the square and no farther.
    expect(blurred[32 * N + 40]).toBeGreaterThan(0)
    expect(blurred[32 * N + 50]).toBe(0)
  })

  it('blurs more with a larger disc', () => {
    const field = square()
    expect(Math.max(...blurField(field, N, 12))).toBeLessThan(Math.max(...blurField(field, N, 6)))
  })
})
