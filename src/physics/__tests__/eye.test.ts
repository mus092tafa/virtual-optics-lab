import { describe, expect, it } from 'vitest'
import { EYE } from '../constants'
import {
  NORMAL_AXIAL_LENGTH,
  accommodationOf,
  axialLengthFor,
  cornealPower,
  focusDistance,
  focusedVergence,
  lensPower,
  lensShape,
  maxAccommodation,
  refractiveError,
  sharpnessOf,
  solveEye,
  stateForAccommodation,
  totalPower,
} from '../eye'
import type { EyeSetup } from '../eye'
import { compose, surfaceMatrix, translation } from '../rayTransfer'
import { correctingPower, objectVergence, propagateVergence, refractiveErrorFromPower, vergenceAtCornea, vergenceAtGlassesFor } from '../spectacles'
import { cm, mm, um } from '../units'

const NORMAL = { axialLength: NORMAL_AXIAL_LENGTH, cornealRadius: EYE.cornealRadius }

function setup(overrides: Partial<EyeSetup> = {}): EyeSetup {
  return {
    ...NORMAL,
    age: 20,
    pupilDiameter: mm(4),
    objectDistance: Infinity,
    letterHeight: mm(8.7),
    letterAngle: 5 * (Math.PI / 180 / 60),
    heldAccommodation: null,
    glasses: null,
    ...overrides,
  }
}

describe('refraction at a spherical surface', () => {
  it('has the power (n′ − n)/r', () => {
    const [a, b, c, d] = surfaceMatrix(1, 4 / 3, mm(7.8))
    expect(a).toBe(1)
    expect(b).toBe(0)
    // A ray parallel to the axis at height y leaves with n′u′ = −P y.
    expect(-(4 / 3) * c).toBeCloseTo((4 / 3 - 1) / mm(7.8), 9)
    expect(d).toBeCloseTo(3 / 4, 12)
  })

  it('images an axial point by n′/l′ − n/l = P', () => {
    const n = 1
    const nPrime = 1.5
    const radius = cm(5)
    const objectDistance = cm(30)
    const power = (nPrime - n) / radius
    const imageDistance = nPrime / (power + n / -objectDistance)
    // All rays from the object point meet the axis at l′: B of object → image is zero.
    const system = compose(translation(imageDistance), compose(surfaceMatrix(n, nPrime, radius), translation(objectDistance)))
    expect(system[1]).toBeCloseTo(0, 12)
    expect(imageDistance).toBeCloseTo(cm(22.5), 9)
  })
})

describe('schematic eye', () => {
  it('has the powers of the Gullstrand–Emsley eye when relaxed', () => {
    expect(cornealPower(EYE.cornealRadius)).toBeCloseTo(42.74, 2)
    expect(lensPower(lensShape(0))).toBeCloseTo(21.75, 1)
    expect(totalPower(EYE.cornealRadius, 0)).toBeCloseTo(60.48, 1)
  })

  it('focuses a distant object 23.90 mm behind the cornea', () => {
    expect(focusDistance(EYE.cornealRadius, 0, 0)! / mm(1)).toBeCloseTo(23.9, 1)
    expect(NORMAL_AXIAL_LENGTH / mm(1)).toBeCloseTo(23.9, 1)
    expect(refractiveError(NORMAL)).toBeCloseTo(0, 9)
  })

  it('agrees with the vergence equation surface by surface', () => {
    // L′ = L + P at each surface, reduced vergence carried across each gap.
    const shape = lensShape(0)
    const n = EYE.humourIndex
    const across = (vergence: number, distance: number, index: number) => vergence / (1 - (distance / index) * vergence)
    let vergence = -4 + cornealPower(EYE.cornealRadius)
    vergence = across(vergence, shape.chamberDepth, n) + (EYE.lensIndex - n) / shape.frontRadius
    vergence = across(vergence, shape.thickness, EYE.lensIndex) + (n - EYE.lensIndex) / shape.backRadius
    const expected = shape.chamberDepth + shape.thickness + n / vergence
    expect(focusDistance(EYE.cornealRadius, 0, -4)).toBeCloseTo(expected, 9)
  })

  it('takes its power from the corneal curvature', () => {
    expect(cornealPower(mm(7.29))).toBeCloseTo(45.7, 1)
    expect(refractiveError({ axialLength: NORMAL_AXIAL_LENGTH, cornealRadius: mm(7.29) })).toBeCloseTo(-3, 1)
  })
})

describe('accommodation', () => {
  it('reaches 8.6 D in the accommodated schematic eye', () => {
    expect(lensPower(lensShape(1))).toBeCloseTo(32.3, 1)
    expect(accommodationOf(NORMAL, 1)).toBeCloseTo(8.6, 1)
    expect(-1 / focusedVergence(NORMAL, 1) / cm(1)).toBeCloseTo(11.6, 1)
  })

  it('finds the lens state for a wanted accommodation', () => {
    for (const wanted of [0.5, 2, 5, 8.6, 12.5, 14]) expect(accommodationOf(NORMAL, stateForAccommodation(NORMAL, wanted))).toBeCloseTo(wanted, 6)
    expect(stateForAccommodation(NORMAL, 0)).toBe(0)
    expect(stateForAccommodation(NORMAL, 8.6)).toBeCloseTo(1, 2)
  })

  it('focuses an object that is within reach', () => {
    const { view } = solveEye(setup({ age: 20, objectDistance: cm(25) }))
    expect(view.accommodation).toBeCloseTo(4, 9)
    expect(view.focusOffset! / um(1)).toBeCloseTo(0, 3)
    expect(view.blurDiameter / um(1)).toBeCloseTo(0, 3)
  })

  it('stops at its limit for an object nearer than the near point', () => {
    const { view } = solveEye(setup({ age: 55, objectDistance: cm(25) }))
    expect(view.accommodation).toBeCloseTo(2, 9)
    expect(view.accommodationNeeded).toBeCloseTo(4, 9)
    expect(view.focusOffset!).toBeGreaterThan(0)
    expect(view.blurDiameter).toBeGreaterThan(um(100))
  })

  it('stays where the student holds it', () => {
    const far = solveEye(setup({ heldAccommodation: 0 })).view
    const near = solveEye(setup({ heldAccommodation: 0, objectDistance: cm(25) })).view
    expect(far.focusOffset! / mm(1)).toBeCloseTo(0, 6)
    expect(near.accommodation).toBe(0)
    expect(near.focusOffset! / mm(1)).toBeCloseTo(1.55, 2)
  })

  it('cannot be held beyond the eye’s limit', () => {
    expect(solveEye(setup({ age: 55, heldAccommodation: 6 })).view.accommodation).toBeCloseTo(2, 9)
  })
})

describe('age', () => {
  it('follows Hofstetter’s average', () => {
    expect(maxAccommodation(20)).toBeCloseTo(12.5, 9)
    expect(maxAccommodation(45)).toBeCloseTo(5, 9)
    expect(maxAccommodation(55)).toBeCloseTo(2, 9)
    expect(maxAccommodation(70)).toBe(0)
  })

  it('moves the near point away', () => {
    const nearPoint = (age: number) => solveEye(setup({ age })).view.nearPoint! / cm(1)
    expect(nearPoint(20)).toBeCloseTo(8, 6)
    expect(nearPoint(45)).toBeCloseTo(20, 6)
    expect(nearPoint(55)).toBeCloseTo(50, 6)
    expect(solveEye(setup({ age: 70 })).view.nearPoint).toBe(Infinity)
  })

  it('leaves the relaxed eye alone', () => {
    const young = solveEye(setup({ age: 20, heldAccommodation: 0 }))
    const old = solveEye(setup({ age: 70, heldAccommodation: 0 }))
    expect(old.refractiveError).toBe(young.refractiveError)
    expect(old.cornealPower).toBe(young.cornealPower)
    expect(old.view.lensPower).toBe(young.view.lensPower)
    expect(old.view.farPoint).toBe(young.view.farPoint)
  })
})

describe('refractive errors', () => {
  it('come from the length of the eye', () => {
    expect(axialLengthFor(-3) / mm(1)).toBeCloseTo(25.04, 2)
    expect(axialLengthFor(3) / mm(1)).toBeCloseTo(22.85, 2)
    expect(refractiveError({ ...NORMAL, axialLength: axialLengthFor(-3) })).toBeCloseTo(-3, 9)
  })

  it('put the focus of a myopic eye in front of the retina', () => {
    const solution = solveEye(setup({ axialLength: axialLengthFor(-3) }))
    expect(solution.view.farPoint! / cm(1)).toBeCloseTo(33.33, 2)
    expect(solution.view.focusOffset! / mm(1)).toBeCloseTo(-1.14, 2)
    expect(solution.view.accommodation).toBe(0)
  })

  it('put the focus of a relaxed hyperopic eye behind the retina', () => {
    const solution = solveEye(setup({ axialLength: axialLengthFor(3), heldAccommodation: 0 }))
    expect(solution.refractiveError).toBeCloseTo(3, 9)
    expect(solution.view.focusOffset! / mm(1)).toBeCloseTo(1.05, 2)
    expect(solution.view.farPoint).toBeNull()
  })

  it('let a young hyperope see far by accommodating', () => {
    const { view } = solveEye(setup({ age: 20, axialLength: axialLengthFor(3) }))
    expect(view.accommodation).toBeCloseTo(3, 9)
    expect(view.blurDiameter / um(1)).toBeCloseTo(0, 3)
  })
})

describe('blur on the retina', () => {
  it('is the pupil-edge ray at the retina', () => {
    const { view } = solveEye(setup({ age: 70, objectDistance: cm(25) }))
    expect(view.blurDiameter / um(1)).toBeCloseTo(295, 0)
    // The same number from similar triangles behind the lens: the cone from the exit pupil to the focus.
    const [top, , bottom] = view.rays
    const last = top[top.length - 1]
    expect(last.x).toBeCloseTo(view.focusDistance!, 9)
    expect(last.y - bottom[bottom.length - 1].y).toBeCloseTo(0, 9)
  })

  it('is proportional to the pupil and vanishes in focus', () => {
    const wide = solveEye(setup({ age: 70, objectDistance: cm(25), pupilDiameter: mm(4) }), mm(8)).view
    const narrow = solveEye(setup({ age: 70, objectDistance: cm(25), pupilDiameter: mm(2) }), mm(8)).view
    expect(narrow.blurDiameter).toBeCloseTo(wide.blurDiameter / 2, 12)
    expect(narrow.illuminance).toBeCloseTo(wide.illuminance / 4, 12)
    expect(solveEye(setup()).view.blurDiameter).toBeCloseTo(0, 9)
  })

  it('gives the retinal size of a letter from the eye’s focal length', () => {
    // A distant object subtending α is imaged with the height α / F on the retina, inverted.
    const { view } = solveEye(setup())
    expect(view.letterImageHeight).toBeCloseTo(-setup().letterAngle / view.totalPower, 9)
    expect(view.letterImageHeight / um(1)).toBeCloseTo(-24.0, 1)
  })

  it('is graded against the stroke width', () => {
    expect(sharpnessOf(um(1), um(4.8))).toBe('sharp')
    expect(sharpnessOf(um(4), um(4.8))).toBe('slightly blurred')
    expect(sharpnessOf(um(12), um(4.8))).toBe('blurred')
    expect(sharpnessOf(um(295), um(4.8))).toBe('unreadable')
  })

  it('draws rays that cross at the computed focus', () => {
    const { view } = solveEye(setup({ axialLength: axialLengthFor(-3) }))
    const [top, , bottom] = view.rays
    // Behind the lens both rays are straight; they meet where the solver puts the focus.
    const [a1, a2] = top.slice(-2)
    const [b1, b2] = bottom.slice(-2)
    const slopeA = (a2.y - a1.y) / (a2.x - a1.x)
    const slopeB = (b2.y - b1.y) / (b2.x - b1.x)
    const crossing = a1.x + (b1.y - a1.y) / (slopeA - slopeB)
    expect(crossing).toBeCloseTo(view.focusDistance!, 9)
    expect(Math.abs(a2.y - b2.y)).toBeCloseTo(view.blurDiameter, 12)
  })
})

describe('spectacles', () => {
  const at12 = mm(12)

  it('carry a vergence across a distance', () => {
    expect(objectVergence(cm(40))).toBeCloseTo(-2.5, 12)
    expect(objectVergence(Infinity)).toBe(0)
    // Light converging to a point 50 cm ahead converges to it from 40 cm after 10 cm.
    expect(propagateVergence(2, cm(10))).toBeCloseTo(2.5, 12)
  })

  it('give the power that corrects a refractive error', () => {
    expect(correctingPower(-3, at12)).toBeCloseTo(-3.11, 2)
    expect(correctingPower(3, at12)).toBeCloseTo(2.9, 2)
    expect(correctingPower(-6, at12)).toBeCloseTo(-6.47, 2)
    expect(correctingPower(-6, 0)).toBe(-6)
    expect(refractiveErrorFromPower(-3, at12)).toBeCloseTo(-2.9, 2)
    expect(refractiveErrorFromPower(correctingPower(-4.5, at12), at12)).toBeCloseTo(-4.5, 12)
  })

  it('reduce the accommodation needed for reading', () => {
    const glasses = { power: 1.5, vertexDistance: at12 }
    expect(vergenceAtCornea(objectVergence(cm(40)), glasses)).toBeCloseTo(-0.99, 2)
    expect(vergenceAtGlassesFor(vergenceAtCornea(-2.5, glasses), glasses)).toBeCloseTo(-2.5, 12)
    const withGlasses = solveEye(setup({ objectDistance: cm(41.2), glasses }))
    expect(withGlasses.view.accommodation).toBeCloseTo(0.99, 2)
    expect(withGlasses.bare!.accommodation).toBeCloseTo(2.43, 2)
  })

  it('bring the image of a myopic eye onto the retina', () => {
    const axialLength = axialLengthFor(-3)
    const exact = solveEye(setup({ axialLength, glasses: { power: correctingPower(-3, at12), vertexDistance: at12 } }))
    expect(exact.correctingPower).toBeCloseTo(-3.11, 2)
    expect(exact.view.blurDiameter / um(1)).toBeCloseTo(0, 3)
    expect(exact.view.focusOffset! / um(1)).toBeCloseTo(0, 3)
    expect(exact.bare!.blurDiameter / um(1)).toBeCloseTo(235, 0)
    expect(exact.bare!.sharpness).toBe('unreadable')
    expect(exact.view.sharpness).toBe('sharp')
    expect(exact.view.farPoint).toBe(Infinity)

    const stocked = solveEye(setup({ axialLength, glasses: { power: -3, vertexDistance: at12 } }))
    expect(stocked.view.vergence).toBeCloseTo(-2.9, 2)
    expect(stocked.view.accommodationNeeded).toBeCloseTo(-0.1, 2)
  })

  it('are over-corrected without the young eye noticing', () => {
    const { view } = solveEye(setup({ age: 20, axialLength: axialLengthFor(-3), glasses: { power: -4, vertexDistance: at12 } }))
    expect(view.accommodation).toBeGreaterThan(0.5)
    expect(view.blurDiameter / um(1)).toBeCloseTo(0, 3)
  })

  it('change the size of the retinal image', () => {
    // A diverging lens in front of the eye makes the image smaller: spectacle magnification 1 / (1 − a Fs) with a to the entrance pupil.
    const axialLength = axialLengthFor(-3)
    const solution = solveEye(setup({ axialLength, glasses: { power: correctingPower(-3, at12), vertexDistance: at12 } }))
    const ratio = solution.view.letterImageHeight / solution.bare!.letterImageHeight
    expect(ratio).toBeLessThan(1)
    expect(ratio).toBeGreaterThan(0.93)
  })
})
