import { describe, expect, it } from 'vitest'
import { DEFAULT_LENS_APERTURE, HENE_WAVELENGTH } from '../constants'
import { centralMaximumWidth } from '../diffraction'
import { fringeSpacing } from '../interference'
import { solveBench } from '../optics'
import type { BenchComponent } from '../types'
import { cm, mm } from '../units'

const options = { diffractionModel: 'fraunhofer' as const }
const lamp = (x: number, intensity = 1): BenchComponent => ({ id: 'lamp', kind: 'tungsten', x, intensity, sourceSize: mm(4) })
const laser = (x: number): BenchComponent => ({ id: 'laser', kind: 'laser', x, lineId: 'red' })
const lens = (x: number, f: number, id = 'lens'): BenchComponent => ({
  id, kind: 'lens', x, focalLength: f, aperture: DEFAULT_LENS_APERTURE, concealed: false,
})
const object = (x: number): BenchComponent => ({ id: 'object', kind: 'object', x, shape: 'arrow', height: mm(20), letter: 'F' })
const screen = (x: number): BenchComponent => ({ id: 'screen', kind: 'screen', x })

describe('bench solver: image formation on the screen', () => {
  const setup = (screenX: number, intensity = 1) =>
    solveBench([lamp(cm(5), intensity), object(cm(15)), lens(cm(45), cm(10)), screen(screenX)], options)

  it('reports the thin-lens solution (f = 10, do = 30 -> di = 15, m = −0.5)', () => {
    const s = setup(cm(60))
    expect(s.regime).toBe('imaging')
    expect(s.model).toBe('geometric optics')
    const stage = s.imaging!.sequence!.stages[0]
    expect(stage.objectDistance).toBeCloseTo(cm(30), 12)
    expect(stage.imageDistance).toBeCloseTo(cm(15), 12)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(-0.5, 12)
    expect(s.imaging!.imageHeight).toBeCloseTo(mm(-10), 12)
  })
  it('image is sharp only when the screen is in the image plane', () => {
    const sharp = setup(cm(60))
    expect(sharp.imaging!.screen!.inFocus).toBe(true)
    expect(sharp.imaging!.screen!.blurDiameter).toBeCloseTo(0, 12)
    const light = sharp.screenLight!
    expect(light.kind).toBe('image')
    if (light.kind === 'image') expect(light.scale).toBeCloseTo(-0.5, 12)

    const behind = setup(cm(65))
    expect(behind.imaging!.screen!.inFocus).toBe(false)
    // c = D |s − di| / di = 40 mm × 5 / 15
    expect(behind.imaging!.screen!.blurDiameter).toBeCloseTo(mm(40 * 5 / 15), 10)
    const front = setup(cm(55))
    expect(front.imaging!.screen!.blurDiameter).toBeCloseTo(mm(40 * 5 / 15), 10)
    expect(setup(cm(75)).imaging!.screen!.blurDiameter).toBeGreaterThan(behind.imaging!.screen!.blurDiameter)
  })
  it('moving the screen does not move the calculated image', () => {
    expect(setup(cm(55)).imaging!.sequence!.imageX).toBeCloseTo(setup(cm(90)).imaging!.sequence!.imageX, 12)
  })
  it('lamp intensity changes brightness but not geometry', () => {
    const full = setup(cm(62), 1)
    const dim = setup(cm(62), 0.3)
    expect(dim.imaging).toEqual(full.imaging)
    const a = full.screenLight!
    const b = dim.screenLight!
    if (a.kind !== 'image' || b.kind !== 'image') throw new Error('expected images')
    expect(b.level / a.level).toBeCloseTo(0.3, 12)
    expect(b.scale).toBe(a.scale)
    expect(b.blurDiameter).toBe(a.blurDiameter)
  })
  it('image irradiance follows E ∝ D² / s²', () => {
    const near = setup(cm(60)).imaging!.screen!
    expect(near.irradiancePerRadiance).toBeCloseTo((Math.PI * DEFAULT_LENS_APERTURE ** 2) / (4 * cm(15) ** 2), 10)
  })
  it('object inside the focal length gives a virtual, upright, magnified image', () => {
    const s = solveBench([lamp(cm(5)), object(cm(39)), lens(cm(45), cm(10)), screen(cm(70))], options)
    const sequence = s.imaging!.sequence!
    expect(sequence.isReal).toBe(false)
    expect(sequence.magnification).toBeCloseTo(2.5, 10)
    expect(sequence.imageX).toBeCloseTo(cm(30), 10)
    expect(s.imaging!.screen!.inFocus).toBe(false)
  })
  it('without a lens no image forms', () => {
    const s = solveBench([lamp(cm(5)), object(cm(15)), screen(cm(60))], options)
    expect(s.screenLight!.kind).toBe('uniform')
  })
  it('with no object the lamp aperture itself is imaged', () => {
    const s = solveBench([lamp(cm(5)), lens(cm(25), cm(10)), screen(cm(45))], options)
    expect(s.regime).toBe('imaging')
    const light = s.screenLight!
    if (light.kind !== 'image') throw new Error('expected image')
    expect(light.shape).toBe('disc')
    expect(light.scale).toBeCloseTo(-1, 12)
    expect(light.blurDiameter).toBeCloseTo(0, 12)
  })
  it('a screen in front of the lens receives no image; a screen behind the source is dark', () => {
    expect(solveBench([lamp(cm(5)), object(cm(15)), screen(cm(30)), lens(cm(45), cm(10))], options).screenLight!.kind).toBe('uniform')
    expect(solveBench([screen(cm(2)), lamp(cm(5)), object(cm(15))], options).screenLight!.kind).toBe('dark')
  })
  it('two lenses form a relayed image', () => {
    const s = solveBench([lamp(0.01), object(cm(10)), lens(cm(40), cm(10), 'a'), lens(cm(75), cm(5), 'b'), screen(cm(75 + 20 / 3))], options)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(1 / 6, 10)
    expect(s.imaging!.screen!.inFocus).toBe(true)
  })
})

describe('bench solver: He-Ne laser', () => {
  it('uses Gaussian beam optics and gives a small spot at the lens focus', () => {
    const atFocus = solveBench([laser(cm(5)), lens(cm(40), cm(10)), screen(cm(50.3))], options)
    expect(atFocus.model).toBe('Gaussian beam optics')
    expect(atFocus.wavelength).toBe(HENE_WAVELENGTH)
    const far = solveBench([laser(cm(5)), lens(cm(40), cm(10)), screen(cm(80))], options)
    const a = atFocus.screenLight!
    const b = far.screenLight!
    if (a.kind !== 'spot' || b.kind !== 'spot') throw new Error('expected spots')
    expect(a.radius).toBeLessThan(mm(0.06))
    expect(b.radius).toBeGreaterThan(mm(1))
  })
  it('without optics the spot is about a millimetre across and grows slowly', () => {
    const near = solveBench([laser(0), screen(cm(20))], options).screenLight!
    const far = solveBench([laser(0), screen(cm(140))], options).screenLight!
    if (near.kind !== 'spot' || far.kind !== 'spot') throw new Error('expected spots')
    expect(near.radius).toBeGreaterThan(mm(0.4))
    expect(far.radius).toBeGreaterThan(near.radius)
    expect(far.radius).toBeLessThan(mm(1))
  })
})

describe('bench solver: diffraction and interference', () => {
  const single = (width: number, screenX = cm(140)) =>
    solveBench([laser(cm(5)), { id: 's', kind: 'singleSlit', x: cm(30), width, orientation: 'vertical' }, screen(screenX)], options)
  const double = (separation: number, screenX = cm(140), model: 'fraunhofer' | 'fresnel' = 'fraunhofer') =>
    solveBench(
      [laser(cm(5)), { id: 'd', kind: 'doubleSlit', x: cm(30), width: mm(0.04), separation, orientation: 'vertical' }, screen(screenX)],
      { diffractionModel: model },
    )

  it('single slit: central maximum width matches 2Ltanθ₁ and widens for narrower slits', () => {
    const s = single(mm(0.1))
    expect(s.model).toBe('wave optics')
    expect(s.diffraction!.distance).toBeCloseTo(1.1, 12)
    expect(s.diffraction!.centralMaximumWidth).toBeCloseTo(centralMaximumWidth(mm(0.1), HENE_WAVELENGTH, 1.1), 12)
    expect(s.diffraction!.regime).toBe('far-field')
    expect(single(mm(0.05)).diffraction!.centralMaximumWidth).toBeGreaterThan(s.diffraction!.centralMaximumWidth)
  })
  it('moving the screen away widens the pattern', () => {
    expect(single(mm(0.1), cm(140)).diffraction!.centralMaximumWidth).toBeGreaterThan(
      single(mm(0.1), cm(90)).diffraction!.centralMaximumWidth,
    )
  })
  it('double slit: fringe spacing λL/d shrinks as the separation grows', () => {
    const s = double(mm(0.25))
    expect(s.diffraction!.fringeSpacing).toBeCloseTo(fringeSpacing(mm(0.25), HENE_WAVELENGTH, 1.1), 12)
    expect(double(mm(0.5)).diffraction!.fringeSpacing).toBeLessThan(s.diffraction!.fringeSpacing!)
  })
  it('flags the near field instead of silently using Fraunhofer', () => {
    const s = single(mm(0.5), cm(34))
    expect(s.diffraction!.regime).toBe('near-field')
    expect(s.notices.some((n) => n.level === 'error' && n.text.includes('NOT valid'))).toBe(true)
    expect(single(mm(0.1)).notices.some((n) => n.level === 'error')).toBe(false)
  })
  it('the rendered pattern comes from the equations', () => {
    const light = double(mm(0.25)).screenLight!
    if (light.kind !== 'fringes') throw new Error('expected fringes')
    const spacing = fringeSpacing(mm(0.25), HENE_WAVELENGTH, 1.1)
    const { intensity } = light.pattern.sample(0, spacing / 2, 3)
    expect(intensity[0]).toBeCloseTo(1, 6)
    expect(intensity[1]).toBeLessThan(1e-4)
    expect(intensity[2]).toBeGreaterThan(0.8)
  })
  it('tungsten light through the double slit is polychromatic and smeared by the source size', () => {
    const s = solveBench(
      [lamp(cm(5)), { id: 'd', kind: 'doubleSlit', x: cm(30), width: mm(0.04), separation: mm(0.25), orientation: 'vertical' }, screen(cm(140))],
      options,
    )
    expect(s.diffraction!.polychromatic).toBe(true)
    // 4 mm source at 25 cm seen over 1.1 m: smear = 4 mm × 1.1 / 0.25
    expect(s.diffraction!.smearWidth).toBeCloseTo(mm(17.6), 9)
    expect(s.diffraction!.smearWidth).toBeGreaterThan(s.diffraction!.fringeSpacing!)
  })
  it('object and slit together are reported as unsupported, not faked', () => {
    const s = solveBench(
      [laser(0), object(cm(10)), { id: 's', kind: 'singleSlit', x: cm(30), width: mm(0.1), orientation: 'vertical' }, screen(cm(90))],
      options,
    )
    expect(s.regime).toBe('unsupported')
    expect(s.screenLight!.kind).toBe('unsupported')
  })
  it('a lens focusing onto the screen produces the Fraunhofer pattern scaled by f', () => {
    // Slit, then a lens, screen in the lens focal plane: B = f.
    const s = solveBench(
      [laser(0), { id: 's', kind: 'singleSlit', x: cm(60), width: mm(0.1), orientation: 'vertical' }, lens(cm(65), cm(20)), screen(cm(85))],
      options,
    )
    expect(s.diffraction!.effectiveB).toBeCloseTo(cm(20), 12)
    expect(s.diffraction!.centralMaximumWidth).toBeCloseTo((2 * HENE_WAVELENGTH * cm(20)) / mm(0.1), 12)
    expect(s.diffraction!.regime).toBe('far-field')
  })
})
