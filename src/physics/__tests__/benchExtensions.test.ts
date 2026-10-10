import { describe, expect, it } from 'vitest'
import { DEFAULT_LENS_APERTURE, HENE_WAVELENGTH } from '../constants'
import { solveBench } from '../optics'
import type { BenchComponent } from '../types'
import { cm, degToRad, mm, perMm } from '../units'

const options = { diffractionModel: 'fraunhofer' as const }
const lamp = (x: number, intensity = 1): BenchComponent => ({ id: 'lamp', kind: 'tungsten', x, intensity, sourceSize: mm(4) })
const laser = (x: number, lineId = 'red'): BenchComponent => ({ id: 'laser', kind: 'laser', x, lineId })
const lens = (x: number, f: number, id = 'lens'): BenchComponent => ({
  id, kind: 'lens', x, focalLength: f, aperture: DEFAULT_LENS_APERTURE, concealed: false,
})
const object = (x: number, height = mm(20)): BenchComponent => ({ id: 'object', kind: 'object', x, shape: 'arrow', height, letter: 'F' })
const screen = (x: number): BenchComponent => ({ id: 'screen', kind: 'screen', x })
const grating = (x: number, linesPerMm = 300, orientation: 'vertical' | 'horizontal' = 'vertical'): BenchComponent => ({
  id: 'grating', kind: 'grating', x, lineDensity: perMm(linesPerMm), aperture: mm(10), orientation,
})
const pinhole = (x: number, diameter = mm(0.2)): BenchComponent => ({ id: 'pinhole', kind: 'pinhole', x, diameter })
const polarizer = (x: number, degrees: number, id = `pol-${x}`): BenchComponent => ({ id, kind: 'polarizer', x, angle: degToRad(degrees) })
const mirror = (x: number, f: number): BenchComponent => ({ id: 'mirror', kind: 'mirror', x, focalLength: f, aperture: mm(40) })

describe('bench solver: diverging lens', () => {
  it('forms a virtual, upright, reduced image of a real object (f = −15, do = 30 -> di = −10, m = +1/3)', () => {
    const s = solveBench([lamp(cm(5)), object(cm(15)), lens(cm(45), -cm(15)), screen(cm(70))], options)
    const stage = s.imaging!.sequence!.stages[0]
    expect(stage.imageDistance).toBeCloseTo(-cm(10), 12)
    expect(stage.magnification).toBeCloseTo(1 / 3, 12)
    expect(s.imaging!.sequence!.isReal).toBe(false)
    expect(s.imaging!.screen!.inFocus).toBe(false)
    expect(s.notices.some((n) => n.text.includes('virtual'))).toBe(true)
    // The virtual image is drawn on the object side.
    expect(s.overlay.images[0].x).toBeCloseTo(cm(35), 12)
    expect(s.overlay.images[0].isReal).toBe(false)
  })

  it('images the virtual object left by a convex lens (s = 10 cm, f = −15 cm -> di = 30 cm)', () => {
    // Convex f = 10 at 35 cm, object at 15 cm: image at 55 cm without the concave lens.
    const alone = solveBench([lamp(cm(5)), object(cm(15)), lens(cm(35), cm(10)), screen(cm(55))], options)
    expect(alone.imaging!.screen!.blurDiameter).toBeCloseTo(0, 10)
    const s = solveBench([lamp(cm(5)), object(cm(15)), lens(cm(35), cm(10), 'a'), lens(cm(45), -cm(15), 'b'), screen(cm(75))], options)
    const second = s.imaging!.sequence!.stages[1]
    expect(second.objectDistance).toBeCloseTo(-cm(10), 12)
    expect(second.imageDistance).toBeCloseTo(cm(30), 12)
    expect(s.imaging!.sequence!.imageX).toBeCloseTo(cm(75), 12)
    expect(s.imaging!.sequence!.isReal).toBe(true)
    // m = (−1)(+3) = −3
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(-3, 10)
    expect(s.imaging!.screen!.inFocus).toBe(true)
    expect(s.imaging!.screen!.blurDiameter).toBeCloseTo(0, 10)
  })

  it('makes a laser beam diverge', () => {
    const free = solveBench([laser(cm(8)), screen(cm(90))], options)
    const diverged = solveBench([laser(cm(8)), lens(cm(40), -cm(10)), screen(cm(90))], options)
    expect(diverged.beam!.radiusAtScreen!).toBeGreaterThan(3 * free.beam!.radiusAtScreen!)
    expect(diverged.beam!.path.waists).toHaveLength(1)
  })
})

describe('bench solver: object with no lens', () => {
  it('draws the diffuse light from the object out to the whole screen', () => {
    const s = solveBench([lamp(cm(5)), object(cm(35)), screen(cm(95))], options)
    expect(s.screenLight!.kind).toBe('uniform')
    expect(s.overlay.bundle!.upper).toEqual([{ x: cm(35), y: mm(20) }, { x: cm(95), y: mm(60) }])
    expect(s.overlay.bundle!.lower).toEqual([{ x: cm(35), y: 0 }, { x: cm(95), y: -mm(60) }])
  })
})

describe('bench solver: diffraction grating', () => {
  const setup = (extra: BenchComponent[] = [], lineId = 'red') => solveBench([laser(cm(8), lineId), grating(cm(100)), screen(cm(125)), ...extra], options)

  it('puts the laser orders at L tan θ with d sin θ = mλ', () => {
    const s = setup()
    expect(s.regime).toBe('diffraction')
    expect(s.model).toBe('wave optics')
    expect(s.grating!.orders.map((o) => o.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(s.grating!.orders[1].position!).toBeCloseTo(mm(48.339), 6)
    expect(s.grating!.orders[1].onScreen).toBe(true)
    expect(s.grating!.orders[2].position!).toBeCloseTo(mm(102.603), 6)
    expect(s.grating!.orders[2].onScreen).toBe(false)
    expect(s.grating!.illuminatedLines).toBeCloseTo(366.6, 0)
    if (s.screenLight?.kind !== 'spots') throw new Error('expected order spots')
    const positions = s.screenLight.spots.map((spot) => spot.position)
    expect(positions).toContain(0)
    expect(positions.some((p) => Math.abs(p - mm(48.339)) < 1e-6)).toBe(true)
    expect(positions.some((p) => Math.abs(p + mm(48.339)) < 1e-6)).toBe(true)
    // The zeroth order has the size of the undeviated beam.
    const free = solveBench([laser(cm(8)), screen(cm(125))], options)
    const zero = s.screenLight.spots.find((spot) => spot.position === 0)!
    expect(zero.radiusAlong).toBeCloseTo(free.beam!.radiusAtScreen!, 12)
  })

  it('moves the orders with the wavelength and the screen distance', () => {
    const green = setup([], 'green')
    expect(green.grating!.orders[1].position!).toBeCloseTo(mm(41.315), 6)
    const far = solveBench([laser(cm(8)), grating(cm(100)), screen(cm(130))], options)
    expect(far.grating!.orders[1].position! / setup().grating!.orders[1].position!).toBeCloseTo(30 / 25, 12)
  })

  it('draws the orders in the side view only when the lines are horizontal', () => {
    expect(setup().overlay.orders!.inViewPlane).toBe(false)
    const turned = solveBench([laser(cm(8)), grating(cm(100), 300, 'horizontal'), screen(cm(125))], options)
    expect(turned.overlay.orders!.inViewPlane).toBe(true)
    const first = turned.overlay.orders!.rays.find((ray) => ray.order === 1)!
    expect(Math.sin(first.angle)).toBeCloseTo(HENE_WAVELENGTH * perMm(300), 12)
    expect(first.strength).toBeCloseTo(0.73684, 5)
  })

  it('shows spectra for the tungsten lamp, red outside blue', () => {
    const s = solveBench([lamp(cm(5)), grating(cm(100)), screen(cm(125))], options)
    expect(s.grating!.polychromatic).toBe(true)
    if (s.screenLight?.kind !== 'fringes') throw new Error('expected a spectrum')
    const { pattern } = s.screenLight
    const inner = pattern.sample(mm(34), 1, 1).rgb
    const outer = pattern.sample(mm(54), 1, 1).rgb
    expect(inner[2]).toBeGreaterThan(inner[0])
    expect(outer[0]).toBeGreaterThan(outer[2])
  })

  it('refuses a lens behind the grating and an object in the same path', () => {
    const withLens = setup([lens(cm(110), cm(10))])
    expect(withLens.regime).toBe('unsupported')
    expect(withLens.screenLight!.kind).toBe('unsupported')
    const withObject = solveBench([lamp(cm(5)), object(cm(20)), grating(cm(100)), screen(cm(125))], options)
    expect(withObject.regime).toBe('unsupported')
    const two = setup([pinhole(cm(50))])
    expect(two.regime).toBe('unsupported')
  })

  it('accepts a lens in front of the grating', () => {
    const s = setup([lens(cm(40), cm(20))])
    expect(s.regime).toBe('diffraction')
    expect(s.grating!.orders[1].position!).toBeCloseTo(mm(48.339), 6)
  })
})

describe('bench solver: circular aperture', () => {
  const setup = (screenX = cm(140), diameter = mm(0.2)) => solveBench([laser(cm(8)), pinhole(cm(30), diameter), screen(screenX)], options)

  it('reports the first dark ring at 1.22 λ L / D', () => {
    const s = setup()
    expect(s.regime).toBe('diffraction')
    expect(s.airy!.firstDarkRingRadius).toBeCloseTo(mm(4.245), 6)
    // The beam is 22 cm from its waist (z_R = 81.4 cm), so the wavefront at the
    // aperture has R = z (1 + (z_R/z)²) = 3.234 m; L_e = L / (1 + L/R) = 0.821 m.
    const zR = (Math.PI * mm(0.405) ** 2) / HENE_WAVELENGTH
    const R = cm(22) * (1 + (zR / cm(22)) ** 2)
    expect(s.airy!.fresnelNumber).toBeCloseTo(mm(0.1) ** 2 / (HENE_WAVELENGTH * (cm(110) / (1 + cm(110) / R))), 10)
    expect(s.airy!.fresnelNumber).toBeCloseTo(0.0193, 3)
    expect(s.airy!.regime).toBe('far-field')
    if (s.screenLight?.kind !== 'field') throw new Error('expected a field')
    expect(s.screenLight.intensity(0, 0)).toBeCloseTo(1, 12)
    expect(s.screenLight.intensity(mm(4.24497), 0)).toBeCloseTo(0, 8)
    // Rotational symmetry.
    expect(s.screenLight.intensity(mm(2), mm(1))).toBeCloseTo(s.screenLight.intensity(-mm(1), mm(2)), 12)
    expect(s.screenLight.intensity(mm(5.69), 0)).toBeCloseTo(0.0175, 3)
  })

  it('widens the pattern for a smaller aperture', () => {
    expect(setup(cm(140), mm(0.1)).airy!.firstDarkRingRadius).toBeCloseTo(2 * setup().airy!.firstDarkRingRadius, 5)
  })

  it('flags the near field and refuses white light', () => {
    const near = setup(cm(35), mm(0.5))
    expect(near.airy!.regime).toBe('near-field')
    expect(near.notices.some((n) => n.level === 'error')).toBe(true)
    const white = solveBench([lamp(cm(5)), pinhole(cm(30)), screen(cm(140))], options)
    expect(white.regime).toBe('unsupported')
    expect(white.screenLight!.kind).toBe('unsupported')
  })
})

describe('bench solver: polarisers', () => {
  it('scales the light at the screen by the transmitted fraction', () => {
    const none = solveBench([laser(cm(8)), screen(cm(90))], options)
    const one = solveBench([laser(cm(8)), polarizer(cm(35), 70), screen(cm(90))], options)
    const two = solveBench([laser(cm(8)), polarizer(cm(35), 0), polarizer(cm(60), 60), screen(cm(90))], options)
    const level = (s: typeof none) => (s.screenLight?.kind === 'spot' ? s.screenLight.level : NaN)
    expect(none.polarization).toBeNull()
    expect(level(none)).toBe(1)
    expect(level(one)).toBeCloseTo(0.5, 12)
    expect(level(two)).toBeCloseTo(0.125, 12)
    expect(two.polarization!.stages.map((stage) => stage.transmission)).toEqual([0.5, expect.closeTo(0.125, 12)])
  })

  it('extinguishes the light between crossed polarisers and restores 1/8 with a third at 45°', () => {
    const crossed = solveBench([laser(cm(8)), polarizer(cm(35), 0), polarizer(cm(60), 90), screen(cm(90))], options)
    expect(crossed.polarization!.transmission).toBeCloseTo(0, 15)
    expect(crossed.notices.some((n) => n.text.includes('Crossed'))).toBe(true)
    const three = solveBench([laser(cm(8)), polarizer(cm(35), 0), polarizer(cm(48), 45), polarizer(cm(60), 90), screen(cm(90))], options)
    expect(three.polarization!.transmission).toBeCloseTo(0.125, 12)
  })

  it('changes brightness only: image position, size and focus stay the same', () => {
    const base = [lamp(cm(5)), object(cm(15)), lens(cm(45), cm(10)), screen(cm(60))]
    const plain = solveBench(base, options)
    const filtered = solveBench([...base, polarizer(cm(30), 25)], options)
    expect(filtered.imaging!.sequence!.imageX).toBe(plain.imaging!.sequence!.imageX)
    expect(filtered.imaging!.sequence!.magnification).toBe(plain.imaging!.sequence!.magnification)
    expect(filtered.imaging!.screen!.blurDiameter).toBe(plain.imaging!.screen!.blurDiameter)
    if (plain.screenLight?.kind !== 'image' || filtered.screenLight?.kind !== 'image') throw new Error('expected images')
    expect(filtered.screenLight.level).toBeCloseTo(plain.screenLight.level / 2, 12)
  })

  it('ignores a polariser that is not between the source and the screen', () => {
    const s = solveBench([laser(cm(20)), polarizer(cm(10), 0), polarizer(cm(120), 90), screen(cm(90))], options)
    expect(s.polarization).toBeNull()
  })
})

describe('bench solver: spherical mirror', () => {
  const setup = (objectX: number, f: number, screenX: number) =>
    solveBench([lamp(cm(58)), object(objectX, mm(12)), mirror(cm(100), f), screen(screenX)], options)

  it('images by 1/f = 1/do + 1/di (f = 20, do = 30 -> di = 60, m = −2)', () => {
    const s = setup(cm(70), cm(20), cm(40))
    expect(s.regime).toBe('imaging')
    expect(s.imaging!.element).toBe('mirror')
    expect(s.mirror).toEqual({ x: cm(100), focalLength: cm(20), radius: cm(40) })
    const stage = s.imaging!.sequence!.stages[0]
    expect(stage.objectDistance).toBeCloseTo(cm(30), 12)
    expect(stage.imageDistance).toBeCloseTo(cm(60), 12)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(-2, 12)
    expect(s.imaging!.imageHeight!).toBeCloseTo(-mm(24), 12)
    expect(s.imaging!.screen!.inFocus).toBe(true)
    expect(s.imaging!.screen!.distance).toBeCloseTo(cm(60), 12)
    // The real image is drawn in front of the mirror, 60 cm from it.
    expect(s.overlay.images[0].x).toBeCloseTo(cm(40), 12)
    expect(s.overlay.images[0].isReal).toBe(true)
  })

  it('blurs the image when the screen leaves the image plane: c = D |s − di| / di', () => {
    const s = setup(cm(70), cm(20), cm(48))
    // s = 52 cm, di = 60 cm, D = 40 mm -> c = 5.33 mm.
    expect(s.imaging!.screen!.blurDiameter).toBeCloseTo(mm(40) * (8 / 60), 10)
    expect(s.imaging!.screen!.inFocus).toBe(false)
  })

  it('gives a same-size inverted image at the centre of curvature', () => {
    const s = setup(cm(60), cm(20), cm(60))
    expect(s.imaging!.sequence!.stages[0].imageDistance).toBeCloseTo(cm(40), 12)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(-1, 12)
    expect(s.imaging!.screen!.inFocus).toBe(true)
  })

  it('gives a virtual image behind the mirror for an object inside the focal length', () => {
    const s = setup(cm(90), cm(20), cm(70))
    const stage = s.imaging!.sequence!.stages[0]
    expect(stage.imageDistance).toBeCloseTo(-cm(20), 12)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(2, 12)
    expect(s.imaging!.sequence!.isReal).toBe(false)
    expect(s.overlay.images[0].x).toBeCloseTo(cm(120), 12)
  })

  it('gives a virtual, upright, reduced image for a convex mirror (f = −15, do = 30 -> di = −10)', () => {
    const s = setup(cm(70), -cm(15), cm(60))
    expect(s.imaging!.sequence!.stages[0].imageDistance).toBeCloseTo(-cm(10), 12)
    expect(s.imaging!.sequence!.magnification).toBeCloseTo(1 / 3, 12)
    expect(s.imaging!.screen!.inFocus).toBe(false)
  })

  it('keeps every drawn ray on the rail side of the mirror', () => {
    const s = setup(cm(70), cm(20), cm(40))
    for (const ray of s.overlay.principalRays) {
      for (const point of [ray.incoming.from, ray.incoming.to, ray.outgoing.from, ray.outgoing.to]) {
        expect(point.x).toBeLessThanOrEqual(cm(100) + 1e-12)
      }
    }
    // The three reflected principal rays meet at the image point (x = 40 cm, y = −24 mm).
    for (const ray of s.overlay.principalRays) {
      const { from, to } = ray.outgoing
      const slope = (to.y - from.y) / (to.x - from.x)
      expect(from.y + slope * (cm(40) - from.x)).toBeCloseTo(-mm(24), 10)
    }
    for (const point of [...s.overlay.bundle!.upper, ...s.overlay.bundle!.lower]) expect(point.x).toBeLessThanOrEqual(cm(100) + 1e-12)
  })

  it('leaves a screen behind the mirror dark', () => {
    const s = setup(cm(70), cm(20), cm(120))
    expect(s.screenLight!.kind).toBe('dark')
  })

  it('refocuses a laser beam like a lens of the same focal length', () => {
    const viaMirror = solveBench([laser(cm(8)), mirror(cm(100), cm(20)), screen(cm(79))], options)
    const viaLens = solveBench([laser(cm(8)), lens(cm(100), cm(20)), screen(cm(121))], options)
    expect(viaMirror.regime).toBe('beam')
    expect(viaMirror.beam!.radiusAtScreen!).toBeCloseTo(viaLens.beam!.radiusAtScreen!, 12)
    expect(viaMirror.overlay.reflectedBeam!.every((sample) => sample.x <= cm(100) + 1e-12)).toBe(true)
    expect(viaMirror.overlay.beam!.every((sample) => sample.x <= cm(100) + 1e-12)).toBe(true)
  })

  it('refuses a lens or aperture in front of the mirror', () => {
    const s = solveBench([lamp(cm(58)), object(cm(70)), lens(cm(85), cm(10)), mirror(cm(100), cm(20)), screen(cm(40))], options)
    expect(s.regime).toBe('unsupported')
    expect(s.screenLight!.kind).toBe('unsupported')
    const t = solveBench([laser(cm(8)), grating(cm(50)), mirror(cm(100), cm(20)), screen(cm(40))], options)
    expect(t.regime).toBe('unsupported')
  })

  it('passes a polariser in front of the mirror twice', () => {
    const s = solveBench([laser(cm(8)), polarizer(cm(50), 0, 'a'), polarizer(cm(70), 60, 'b'), mirror(cm(100), cm(20)), screen(cm(30))], options)
    // ½ · cos²60° · 1 (second pass of b) · cos²60° (second pass of a)
    expect(s.polarization!.transmission).toBeCloseTo(0.5 * 0.25 * 0.25, 12)
    expect(s.polarization!.stages).toHaveLength(4)
  })
})
