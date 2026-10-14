import { describe, expect, it } from 'vitest'
import { UNIT, composeBlocks, gap, meridianMatrix, powerMatrix, principalAxes, scale2, spheroCylinder, thinAstigmaticLens, toricSurface } from '../astigmatism'
import { AVERAGE_CORNEAL_ASPHERICITY, CHROMATIC_LINES, EYE, EYE_REFERENCE_WAVELENGTH } from '../constants'
import { NORMAL_AXIAL_LENGTH, averageLensAsphericity, cornealPower, cornealRadiusFor, equivalentBlurDiameter, longitudinalAberration, refractiveError, solveEye, zoneHeight } from '../eye'
import type { EyeSetup } from '../eye'
import { axisCrossing, rayFrom, refract } from '../eyeRays'
import { chromaticEyeIndex, mediaAt, refractivityScale } from '../ocularDispersion'
import { compose, surfaceMatrix, thinLensMatrix, translation } from '../rayTransfer'
import { correctingLens, refractionFromLens } from '../spectacles'
import { degToRad, mm, nm, um } from '../units'

const DEG = Math.PI / 180

function setup(overrides: Partial<EyeSetup> = {}): EyeSetup {
  return {
    axialLength: NORMAL_AXIAL_LENGTH,
    cornealRadius: EYE.cornealRadius,
    age: 20,
    pupilDiameter: mm(4),
    objectDistance: Infinity,
    letterHeight: mm(8.7),
    letterAngle: 5 * (DEG / 60),
    heldAccommodation: 0,
    glasses: null,
    ...overrides,
  }
}

/** The vertical meridian 2 D steeper than the horizontal one: with-the-rule astigmatism. */
const STEEP = cornealRadiusFor(cornealPower(EYE.cornealRadius) + 2)
const WITH_THE_RULE = { cornealRadiusCross: STEEP, cornealMeridian: 0 }

describe('ray transfer in two meridians', () => {
  it('is the scalar matrix twice for a symmetric system', () => {
    const scalar = compose(translation(mm(3.6)), compose(surfaceMatrix(1, 4 / 3, mm(7.8)), compose(translation(mm(12)), thinLensMatrix(1 / -3))))
    const blocks = composeBlocks(gap(mm(3.6)), composeBlocks(toricSurface(1, 4 / 3, scale2(UNIT, 1 / mm(7.8))), composeBlocks(gap(mm(12)), thinAstigmaticLens(scale2(UNIT, -3)))))
    const parts = [blocks.a, blocks.b, blocks.c, blocks.d]
    parts.forEach((part, index) => {
      expect(part[0]).toBeCloseTo(scalar[index], 12)
      expect(part[3]).toBeCloseTo(scalar[index], 12)
      expect(part[1]).toBe(0)
      expect(part[2]).toBe(0)
    })
  })

  it('gives each meridian of a toric surface the power (n′ − n)/r', () => {
    const surface = toricSurface(1, 4 / 3, meridianMatrix(1 / mm(7.8), 1 / STEEP, 0))
    expect(-(4 / 3) * surface.c[0]).toBeCloseTo(42.735, 3)
    expect(-(4 / 3) * surface.c[3]).toBeCloseTo(44.735, 3)
  })

  it('writes a power matrix as sphere, negative cylinder and axis, and back', () => {
    for (const lens of [
      { sphere: -1.5, cylinder: -2.25, axis: degToRad(35) },
      { sphere: 2, cylinder: -0.75, axis: degToRad(170) },
    ]) {
      const back = spheroCylinder(powerMatrix(lens))
      expect(back.sphere).toBeCloseTo(lens.sphere, 12)
      expect(back.cylinder).toBeCloseTo(lens.cylinder, 12)
      expect(back.axis).toBeCloseTo(lens.axis, 12)
    }
    // A positive cylinder is transposed: +1.00 / +2.00 × 90 is +3.00 / −2.00 × 180.
    const transposed = spheroCylinder(powerMatrix({ sphere: 1, cylinder: 2, axis: degToRad(90) }))
    expect(transposed.sphere).toBeCloseTo(3, 12)
    expect(transposed.cylinder).toBeCloseTo(-2, 12)
    expect(Math.sin(transposed.axis)).toBeCloseTo(0, 9)
  })

  it('leaves light along the axis of a cylinder undeviated', () => {
    const matrix = powerMatrix({ sphere: 0, cylinder: -2, axis: degToRad(30) })
    const along = [Math.cos(degToRad(30)), Math.sin(degToRad(30))]
    expect(matrix[0] * along[0] + matrix[1] * along[1]).toBeCloseTo(0, 12)
    expect(matrix[2] * along[0] + matrix[3] * along[1]).toBeCloseTo(0, 12)
  })

  it('finds the semi-axes of the image of a circle', () => {
    const axes = principalAxes(meridianMatrix(3, 1, degToRad(40)))
    expect(axes.major).toBeCloseTo(3, 12)
    expect(axes.minor).toBeCloseTo(1, 12)
    expect(axes.angle).toBeCloseTo(degToRad(40), 12)
  })
})

describe('the astigmatic eye', () => {
  it('has two corneal powers and a refraction of 0.00 / −2.00 × 180', () => {
    expect(STEEP / mm(1)).toBeCloseTo(7.451, 3)
    const solution = solveEye(setup(WITH_THE_RULE))
    expect(solution.cornealPower).toBeCloseTo(42.74, 2)
    expect(solution.cornealPowerCross).toBeCloseTo(44.74, 2)
    expect(solution.astigmatic).toBe(true)
    expect(solution.refraction.sphere).toBeCloseTo(0, 6)
    expect(solution.refraction.cylinder).toBeCloseTo(-2, 6)
    expect(Math.sin(solution.refraction.axis)).toBeCloseTo(0, 9)
    expect(solution.refractiveError).toBeCloseTo(-1, 6)
  })

  it('forms a vertical line on the retina and a horizontal one 0.71 mm in front of it', () => {
    const { view } = solveEye(setup(WITH_THE_RULE))
    const [front, back] = view.focalLines!
    expect(front.offset / mm(1)).toBeCloseTo(-0.708, 2)
    expect(back.offset / um(1)).toBeCloseTo(0, 3)
    // The line on the retina is the blur itself: 150 µm long, vertical, with no width.
    expect(view.blur.major / um(1)).toBeCloseTo(150.4, 0)
    expect(view.blur.minor / um(1)).toBeCloseTo(0, 6)
    expect(view.blur.angle).toBeCloseTo(Math.PI / 2, 6)
    expect(Math.cos(back.angle)).toBeCloseTo(0, 6)
    expect(Math.sin(front.angle)).toBeCloseTo(0, 6)
    // The eye would have to relax by 1 D to bring the circle of least confusion to the retina.
    expect(view.accommodationNeeded).toBeCloseTo(-1, 6)
    expect(view.accommodation).toBe(0)
  })

  it('turns the lines with the cornea and leaves their positions', () => {
    const straight = solveEye(setup(WITH_THE_RULE))
    const turned = solveEye(setup({ cornealRadiusCross: STEEP, cornealMeridian: degToRad(30) }))
    expect(turned.refraction.cylinder).toBeCloseTo(-2, 6)
    expect(turned.refraction.axis).toBeCloseTo(degToRad(30), 6)
    expect(turned.view.focalLines![0].offset).toBeCloseTo(straight.view.focalLines![0].offset, 9)
    expect(turned.view.blur.major).toBeCloseTo(straight.view.blur.major, 9)
    expect(turned.view.blur.angle).toBeCloseTo(degToRad(120), 6)
    expect(turned.view.skew).toBe(true)
    expect(straight.view.skew).toBe(false)
  })

  it('has a circle of least confusion of 75 µm on the retina for an object at 1 m', () => {
    const { view } = solveEye(setup({ ...WITH_THE_RULE, objectDistance: 1 }))
    expect(view.blur.major / um(1)).toBeCloseTo(75, 0)
    expect(view.blur.minor / um(1)).toBeCloseTo(75, 0)
  })

  it('halves both diameters with half the pupil', () => {
    const wide = solveEye(setup({ ...WITH_THE_RULE, objectDistance: 0.5 })).view
    const narrow = solveEye(setup({ ...WITH_THE_RULE, objectDistance: 0.5, pupilDiameter: mm(2) })).view
    expect(narrow.blur.major).toBeCloseTo(wide.blur.major / 2, 9)
    expect(narrow.blur.minor).toBeCloseTo(wide.blur.minor / 2, 9)
  })

  it('accommodates to the dioptric midpoint when it can', () => {
    // A hyperopic astigmat: both meridians behind the retina, the midpoint 2 D away.
    const eye = setup({ ...WITH_THE_RULE, axialLength: NORMAL_AXIAL_LENGTH - mm(1.1), heldAccommodation: null })
    const solution = solveEye(eye)
    expect(solution.view.accommodation).toBeCloseTo(solution.refractiveError, 6)
    // The midpoint in dioptres is the circle of least confusion to within a percent.
    expect(solution.view.blur.major / solution.view.blur.minor).toBeCloseTo(1, 1)
    expect(solution.view.blur.major).toBeGreaterThan(um(50))
  })

  it('is the symmetric eye when the radii are equal, whatever the orientation', () => {
    const plain = solveEye(setup({ objectDistance: 0.25 }))
    const same = solveEye(setup({ objectDistance: 0.25, cornealRadiusCross: EYE.cornealRadius, cornealMeridian: degToRad(37) }))
    expect(same.astigmatic).toBe(false)
    expect(same.view.blurDiameter).toBeCloseTo(plain.view.blurDiameter, 12)
    expect(same.view.focusOffset).toBeCloseTo(plain.view.focusOffset!, 12)
    expect(same.view.letterImageHeight).toBeCloseTo(plain.view.letterImageHeight, 12)
    // The pinned case of the symmetric eye: 295 µm at 25 cm with no accommodation and a 4 mm pupil.
    expect(plain.view.blurDiameter / um(1)).toBeCloseTo(295, 0)
    expect(plain.view.blur.major).toBeCloseTo(plain.view.blur.minor, 12)
    expect(plain.view.focalLines![0].distance).toBeCloseTo(plain.view.focalLines![1].distance, 9)
  })
})

describe('cylinder glasses', () => {
  it('correct 0.00 / −2.00 × 180 with 0.00 / −2.05 × 180 at 12 mm', () => {
    const solution = solveEye(setup(WITH_THE_RULE))
    expect(solution.correctingLens.sphere).toBeCloseTo(0, 6)
    expect(solution.correctingLens.cylinder).toBeCloseTo(-2.049, 3)
    const worn = solveEye(setup({ ...WITH_THE_RULE, glasses: { power: 0, cylinder: solution.correctingLens.cylinder, axis: solution.correctingLens.axis, vertexDistance: mm(12) } }))
    expect(worn.view.blurDiameter / um(1)).toBeCloseTo(0, 6)
    expect(worn.bare!.blur.major / um(1)).toBeCloseTo(150.4, 0)
  })

  it('leave a patch of 26 µm when the axis is 10° off', () => {
    const { view } = solveEye(setup({ ...WITH_THE_RULE, glasses: { power: 0, cylinder: -2.049, axis: degToRad(170), vertexDistance: mm(12) } }))
    expect(view.blur.major / um(1)).toBeCloseTo(26, 0)
    expect(view.blur.minor / um(1)).toBeCloseTo(26, 0)
    expect(view.skew).toBe(true)
  })

  it('give a nearly round patch half as large with the spherical equivalent alone', () => {
    const { view } = solveEye(setup({ ...WITH_THE_RULE, glasses: { power: -1, vertexDistance: mm(12) } }))
    expect(view.blur.major / um(1)).toBeCloseTo(75.9, 0)
    expect(view.blur.minor / um(1)).toBeCloseTo(73.7, 0)
  })

  it('reduce to the spherical formula in each principal meridian', () => {
    const lens = correctingLens(meridianMatrix(-3, -6, degToRad(20)), mm(12))
    expect(lens.sphere).toBeCloseTo(-3 / (1 - 0.012 * 3), 9)
    expect(lens.sphere + lens.cylinder).toBeCloseTo(-6 / (1 - 0.012 * 6), 9)
    expect(lens.axis).toBeCloseTo(degToRad(20), 9)
    // And back: a lens found sharp gives the refraction at the cornea.
    const found = refractionFromLens({ sphere: 0, cylinder: -2, axis: 0 }, mm(12))
    expect(found.sphere).toBeCloseTo(0, 9)
    expect(found.cylinder).toBeCloseTo(-1.953, 3)
  })

  it('behave as a spherical lens without a cylinder', () => {
    const plain = solveEye(setup({ axialLength: NORMAL_AXIAL_LENGTH + mm(1.14), glasses: { power: -3, vertexDistance: mm(12) } }))
    const zero = solveEye(setup({ axialLength: NORMAL_AXIAL_LENGTH + mm(1.14), glasses: { power: -3, vertexDistance: mm(12), cylinder: 0, axis: degToRad(45) } }))
    expect(zero.view.blurDiameter).toBeCloseTo(plain.view.blurDiameter, 12)
    expect(zero.view.farPoint).toBe(plain.view.farPoint)
  })
})

describe('the equivalent blur diameter', () => {
  const component = (shape: Parameters<typeof equivalentBlurDiameter>[0][number]['shape'], luminance = 1) => ({ rgb: [1, 1, 1] as const, luminance, energy: 1, shape })

  it('is the diameter of a uniform disc', () => {
    expect(equivalentBlurDiameter([component({ kind: 'ellipse', major: um(147.5), minor: um(147.5), angle: 0 })])).toBeCloseTo(um(295), 12)
  })

  it('is 106 µm for a line 150 µm long', () => {
    expect(equivalentBlurDiameter([component({ kind: 'ellipse', major: um(75), minor: 0, angle: 0 })]) / um(1)).toBeCloseTo(106.07, 2)
  })

  it('agrees for a disc given as rings of equal energy', () => {
    const radii = Array.from({ length: 25 }, (_, i) => um(100) * Math.sqrt(i / 24))
    expect(equivalentBlurDiameter([component({ kind: 'rings', radii })])).toBeCloseTo(um(200), 12)
  })

  it('weights the bands by their luminance', () => {
    const sharp = component({ kind: 'ellipse', major: 0, minor: 0, angle: 0 }, 3)
    const blurred = component({ kind: 'ellipse', major: um(100), minor: um(100), angle: 0 }, 1)
    expect(equivalentBlurDiameter([sharp, blurred])).toBeCloseTo(um(100), 12)
  })
})

describe('chromatic aberration', () => {
  it('uses the index of the chromatic eye, 1.3330 at 589 nm', () => {
    expect(chromaticEyeIndex(EYE_REFERENCE_WAVELENGTH)).toBeCloseTo(1.333, 4)
    expect(refractivityScale(EYE_REFERENCE_WAVELENGTH)).toBe(1)
    expect(mediaAt(EYE_REFERENCE_WAVELENGTH).lens).toBeCloseTo(EYE.lensIndex, 12)
    expect(mediaAt(nm(486)).humour).toBeCloseTo(1.3381, 4)
    expect(mediaAt(nm(656)).lens).toBeCloseTo(1.4136, 4)
  })

  it('makes the normal eye 0.60 D myopic in blue and 0.24 D hyperopic in red', () => {
    const normal = setup()
    expect(refractiveError(normal, mediaAt(CHROMATIC_LINES.blue))).toBeCloseTo(-0.605, 2)
    expect(refractiveError(normal, mediaAt(CHROMATIC_LINES.red))).toBeCloseTo(0.242, 2)
    const solution = solveEye(setup({ dispersion: true, light: CHROMATIC_LINES.blue }))
    expect(solution.refractiveError).toBeCloseTo(-0.605, 2)
    expect(solution.view.focusOffset! / um(1)).toBeCloseTo(-217, -1)
    expect(solveEye(setup({ dispersion: true, light: CHROMATIC_LINES.red })).view.focusOffset! / um(1)).toBeCloseTo(89, -1)
    expect(solution.chromaticDifference).toBeCloseTo(0.847, 2)
  })

  it('stays within 10% of the measured chromatic difference of refraction', () => {
    // Thibos et al.: Rx(λ) = 1.68524 − 0.63346/(λ − 0.21410) with λ in micrometres.
    const measured = (wavelength: number) => 1.68524 - 0.63346 / (wavelength * 1e6 - 0.2141)
    const published = measured(CHROMATIC_LINES.red) - measured(CHROMATIC_LINES.blue)
    expect(published).toBeCloseTo(0.9, 1)
    const model = solveEye(setup({ dispersion: true })).chromaticDifference!
    expect(Math.abs(model - published) / published).toBeLessThan(0.1)
    for (const wavelength of [400, 450, 500, 550, 600, 650, 700]) {
      expect(Math.abs(refractiveError(setup(), mediaAt(nm(wavelength))) - measured(nm(wavelength)))).toBeLessThan(0.1)
    }
  })

  it('changes nothing at 589 nm, and nothing at all while it is switched off', () => {
    const plain = solveEye(setup({ objectDistance: 0.25 }))
    const sodium = solveEye(setup({ objectDistance: 0.25, dispersion: true, light: EYE_REFERENCE_WAVELENGTH }))
    const off = solveEye(setup({ objectDistance: 0.25, light: nm(450) }))
    for (const other of [sodium, off]) {
      expect(other.refractiveError).toBeCloseTo(plain.refractiveError, 12)
      expect(other.view.blurDiameter).toBeCloseTo(plain.view.blurDiameter, 12)
      expect(other.view.lensPower).toBeCloseTo(plain.view.lensPower, 12)
    }
    expect(plain.chromaticDifference).toBeNull()
  })

  it('spreads 450 nm over 70 µm when the eye is in focus at 589 nm', () => {
    const { view } = solveEye(setup({ dispersion: true }))
    expect(view.pointSpread.length).toBe(12)
    // The bands add up to the white of the display, in every channel.
    for (const channel of [0, 1, 2]) expect(view.pointSpread.reduce((sum, component) => sum + component.rgb[channel], 0)).toBeCloseTo(1, 12)
    expect(view.pointSpread.reduce((sum, component) => sum + component.luminance, 0)).toBeCloseTo(1, 12)
    const blue = solveEye(setup({ dispersion: true, light: nm(450), heldAccommodation: 0 })).view
    expect(blue.blurDiameter / um(1)).toBeCloseTo(70, 0)
    // In white light the eye is focused for 589 nm, so the image is no longer a point.
    expect(view.focusOffset! / um(1)).toBeCloseTo(0, 3)
    expect(view.blurDiameter).toBeGreaterThan(um(5))
    expect(view.blurDiameter).toBeLessThan(um(70))
  })

  it('accommodates for the wavelength of monochromatic light', () => {
    const blue = solveEye(setup({ dispersion: true, light: nm(450), objectDistance: 0.25, heldAccommodation: null }))
    expect(blue.view.blurDiameter / um(1)).toBeCloseTo(0, 3)
    // Blue light is focused more strongly, so the lens works less: 4 D of vergence, 0.94 D of myopia.
    expect(blue.view.accommodation).toBeCloseTo(4 + blue.refractiveError, 6)
  })
})

describe('real rays through conicoids', () => {
  const sphere = { vertex: 0, curvature: 1 / mm(7.8), asphericity: 0, indexBefore: 1, indexAfter: 4 / 3 }

  it('cross the axis where the geometry of a sphere says', () => {
    for (const [height, expected] of [
      [1, 31.0553],
      [2, 30.6151],
      [3, 29.8602],
      [4, 28.7523],
    ]) {
      const h = mm(height)
      // i and i′ at the surface, then the triangle with the centre of curvature.
      const i = Math.asin(h / mm(7.8))
      const iPrime = Math.asin(Math.sin(i) / (4 / 3))
      const closedForm = mm(7.8) + (mm(7.8) * Math.sin(iPrime)) / Math.sin(i - iPrime)
      const crossing = axisCrossing(refract(rayFrom(-mm(1), h, 0), sphere)!)!
      expect(crossing).toBeCloseTo(closedForm, 12)
      expect(crossing / mm(1)).toBeCloseTo(expected, 3)
    }
  })

  it('all meet at the paraxial focus of the ellipsoid with Q = −(1/n′)²', () => {
    const ellipsoid = { ...sphere, asphericity: -((3 / 4) ** 2) }
    for (const height of [0.5, 1, 2, 3, 4]) expect(axisCrossing(refract(rayFrom(-mm(1), mm(height), 0), ellipsoid)!)! / mm(1)).toBeCloseTo(31.2, 9)
  })

  it('tend to the paraxial focus near the axis', () => {
    expect(axisCrossing(refract(rayFrom(-mm(1), um(1), 0), sphere)!)! / mm(1)).toBeCloseTo(31.2, 5)
  })

  it('are lost beyond the edge of a surface and at total reflection', () => {
    expect(refract(rayFrom(-mm(1), mm(9), 0), sphere)).toBeNull()
    const glassToAir = { vertex: 0, curvature: 0, asphericity: 0, indexBefore: 1.5, indexAfter: 1 }
    expect(refract(rayFrom(-mm(1), 0, 1), glassToAir)).toBeNull()
    expect(refract(rayFrom(-mm(1), 0, 0.5), glassToAir)).not.toBeNull()
  })
})

describe('spherical aberration of the eye', () => {
  it('is 2.1 D for a 4 mm pupil with spherical surfaces, the marginal ray crossing 0.73 mm early', () => {
    const solution = solveEye(setup({ realRays: true }))
    expect(solution.realRays).toBe(true)
    const aberration = solution.view.sphericalAberration!
    expect(aberration.longitudinal).toBeCloseTo(2.136, 2)
    expect(aberration.marginalOffset! / um(1)).toBeCloseTo(-732, -1)
    // The paraxial focus is still on the retina.
    expect(solution.view.focusOffset! / um(1)).toBeCloseTo(0, 3)
  })

  it('leaves 0.40 mm of blur at a 6 mm pupil although the eye is in paraxial focus', () => {
    expect(solveEye(setup({ realRays: true, pupilDiameter: mm(6) })).view.blurDiameter / um(1)).toBeCloseTo(398, -1)
  })

  it('agrees with paraxial rays for a very small pupil', () => {
    const eye = { pupilDiameter: mm(0.1), objectDistance: 0.25 }
    const real = solveEye(setup({ ...eye, realRays: true })).view
    const paraxial = solveEye(setup(eye)).view
    expect(real.blurDiameter / paraxial.blurDiameter).toBeCloseTo(1, 3)
    expect(real.sphericalAberration!.longitudinal).toBeCloseTo(0, 2)
  })

  it('does not depend on the asphericity while the rays are paraxial', () => {
    const spheres = solveEye(setup({ objectDistance: 0.25 })).view
    const aspheric = solveEye(setup({ objectDistance: 0.25, cornealAsphericity: -0.5, lensAsphericity: -3 })).view
    expect(aspheric.blurDiameter).toBe(spheres.blurDiameter)
    expect(aspheric.sphericalAberration).toBeNull()
  })

  it('has the lens asphericity of the average eye solved for 1.0 D at 3 mm', () => {
    const lens = averageLensAsphericity()
    expect(lens).toBeCloseTo(-2.2, 1)
    // A distant ray entering 3 mm from the axis passes the pupil at 2.70 mm.
    const solution = solveEye(setup({ realRays: true, pupilDiameter: mm(2 * 2.7), cornealAsphericity: AVERAGE_CORNEAL_ASPHERICITY, lensAsphericity: lens }))
    expect(solution.view.sphericalAberration!.longitudinal).toBeCloseTo(1, 1)
  })

  it('moves the sharpest lens with the pupil in the average eye', () => {
    const blur = (pupil: number, power: number) =>
      solveEye(setup({ realRays: true, pupilDiameter: mm(pupil), cornealAsphericity: AVERAGE_CORNEAL_ASPHERICITY, lensAsphericity: averageLensAsphericity(), glasses: { power, vertexDistance: mm(12) } })).view.blurDiameter
    const sharpest = (pupil: number) => [0, -0.25, -0.5, -0.75, -1, -1.25, -1.5, -1.75, -2, -2.25].reduce((best, power) => (blur(pupil, power) < blur(pupil, best) ? power : best))
    expect(sharpest(2)).toBeCloseTo(0, 6)
    expect(sharpest(8)).toBeCloseTo(-1.5, 6)
  })

  it('lets one zone through a ring stop, which one lens brings to a sharp focus', () => {
    const ring = setup({ realRays: true, pupilDiameter: mm(6), pupilZone: 0.9 })
    const solution = solveEye(ring, mm(8))
    // The ray named for the ring passes at its RMS radius, 3 √((1 + 0.9²)/2) = 2.854 mm.
    expect(zoneHeight(mm(6), 0.9) / mm(1)).toBeCloseTo(2.854, 3)
    expect(solution.view.sphericalAberration!.rayHeight).toBe(zoneHeight(mm(6), 0.9))
    expect(solution.view.sphericalAberration!.longitudinal).toBeCloseTo(longitudinalAberration(ring, zoneHeight(mm(6), 0.9))!, 9)
    // The open ring passes 1 − 0.9² of the light of the pupil.
    expect(solution.view.illuminance).toBeCloseTo((6 / 8) ** 2 * 0.19, 9)
    // The rings on the retina no longer start at the axis: the centre of the pupil is covered.
    const shape = solution.view.pointSpread[0].shape
    expect(shape.kind === 'rings' && shape.radii[0]).toBeGreaterThan(um(100))
    // The lens that corrects the zone leaves a blur a small fraction of the uncorrected one.
    const zone = solution.view.sphericalAberration!.zoneRefraction
    const corrected = solveEye({ ...ring, glasses: { power: zone / (1 + 0.012 * zone), vertexDistance: mm(12) } }).view
    expect(corrected.blurDiameter).toBeLessThan(solution.view.blurDiameter / 10)
    // With an open pupil the same eye is named by its edge ray.
    expect(solveEye(setup({ realRays: true, pupilDiameter: mm(6) })).view.sphericalAberration!.rayHeight).toBe(mm(3))
    expect(zoneHeight(mm(6))).toBe(mm(3))
  })

  it('ignores the ring stop for paraxial rays, and says so', () => {
    const open = solveEye(setup({ objectDistance: 0.25 }))
    const stopped = solveEye(setup({ objectDistance: 0.25, pupilZone: 0.8 }))
    expect(stopped.view.blurDiameter).toBe(open.view.blurDiameter)
    expect(stopped.view.illuminance).toBe(open.view.illuminance)
    expect(stopped.notices.join(' ')).toMatch(/ring stop/)
  })

  it('is refused in an astigmatic eye and behind a cylinder, with a notice', () => {
    const astigmatic = solveEye(setup({ ...WITH_THE_RULE, realRays: true }))
    expect(astigmatic.realRays).toBe(false)
    expect(astigmatic.notices.join(' ')).toMatch(/paraxial/)
    expect(astigmatic.view.sphericalAberration).toBeNull()
    expect(solveEye(setup({ realRays: true, glasses: { power: 0, cylinder: -1, axis: 0, vertexDistance: mm(12) } })).realRays).toBe(false)
    expect(solveEye(setup({ realRays: true })).notices).toEqual([])
  })
})

describe('views of the beam', () => {
  it('crosses the rays of each section at the focal line of its meridian', () => {
    const { view } = solveEye(setup(WITH_THE_RULE))
    const crossing = (ray: { x: number; y: number }[]) => {
      const [from, to] = ray.slice(-2)
      return from.x - (from.y * (to.x - from.x)) / (to.y - from.y)
    }
    // Horizontal section: the meridian that is in focus. Vertical section: the steeper one.
    expect(crossing(view.raysTop[0])).toBeCloseTo(NORMAL_AXIAL_LENGTH, 9)
    expect(crossing(view.rays[0])).toBeCloseTo(view.focalLines![0].distance, 9)
    expect(view.rays[1].every((point) => point.y === 0)).toBe(true)
  })

  it('shows the same rays in both sections of a symmetric eye', () => {
    const { view } = solveEye(setup({ objectDistance: 0.25 }))
    view.rays[0].forEach((point, index) => expect(view.raysTop[0][index].y).toBeCloseTo(point.y, 15))
  })

  it('cuts the beam at the focal lines, between them and at the retina', () => {
    const { view } = solveEye(setup({ ...WITH_THE_RULE, objectDistance: 1 }))
    const retina = view.sections.find((section) => section.atRetina)!
    expect(retina.shape.kind).toBe('ellipse')
    if (retina.shape.kind !== 'ellipse') return
    expect(2 * retina.shape.major).toBeCloseTo(view.blur.major, 12)
    expect(2 * retina.shape.minor).toBeCloseTo(view.blur.minor, 12)
    const lines = view.sections.filter((section) => section.shape.kind === 'ellipse' && section.shape.minor < 1e-9 && section.shape.major > 1e-6)
    expect(lines.length).toBe(2)
    expect(lines.map((section) => section.distance)).toEqual(view.focalLines!.map((line) => line.distance))
    for (let i = 1; i < view.sections.length; i++) expect(view.sections[i].distance).toBeGreaterThan(view.sections[i - 1].distance)
  })

  it('gives a point at the retina of an eye in focus', () => {
    const { view } = solveEye(setup({ heldAccommodation: null }))
    const retina = view.sections.find((section) => section.atRetina)!
    expect(retina.shape.kind === 'ellipse' && retina.shape.major).toBeCloseTo(0, 9)
  })
})
