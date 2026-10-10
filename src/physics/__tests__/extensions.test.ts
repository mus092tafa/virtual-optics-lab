import { describe, expect, it } from 'vitest'
import { AIRY_FIRST_ZERO, airyDiscRadius, airyFirstZeroAngle, airyIntensity, apertureFromDarkRing, besselJ1 } from '../airy'
import { HENE_WAVELENGTH } from '../constants'
import { OPTICAL_GLASSES, abbeNumber, opticalGlass, refractiveIndex } from '../dispersion'
import { qAtWaist } from '../gaussianBeam'
import {
  buildGratingSpectrum,
  gratingPeriod,
  highestOrder,
  laserOrderSpots,
  orderAngle,
  orderEfficiency,
  orderPosition,
  trapezoid,
  wavelengthFromOrder,
} from '../grating'
import { malusTransmission, polarizerChain } from '../polarization'
import { incidenceAtMinimumDeviation, indexFromMinimumDeviation, minimumDeviation, solvePrism } from '../prism'
import { brewsterAngle, indexFromBrewsterAngle } from '../refraction'
import { blackbodySpectrum } from '../spectrum'
import { solveSurface } from '../surface'
import { cm, degToRad, mm, nm, perMm, radToDeg } from '../units'

describe('diffraction grating', () => {
  const d300 = gratingPeriod(perMm(300))

  it('places the orders by d sin θ = mλ', () => {
    // 300 lines/mm, 632.8 nm: sin θ₁ = 0.18984.
    expect(radToDeg(orderAngle(1, d300, HENE_WAVELENGTH)!)).toBeCloseTo(10.9434, 3)
    expect(radToDeg(orderAngle(2, d300, HENE_WAVELENGTH)!)).toBeCloseTo(22.3139, 3)
    expect(orderPosition(1, d300, HENE_WAVELENGTH, cm(25))!).toBeCloseTo(mm(48.339), 6)
    expect(orderPosition(-1, d300, HENE_WAVELENGTH, cm(25))!).toBeCloseTo(-mm(48.339), 6)
    expect(orderAngle(0, d300, HENE_WAVELENGTH)).toBe(0)
  })

  it('has no order with m λ / d ≥ 1', () => {
    const d600 = gratingPeriod(perMm(600))
    expect(highestOrder(d600, HENE_WAVELENGTH)).toBe(2)
    expect(orderAngle(3, d600, HENE_WAVELENGTH)).toBeNull()
    expect(highestOrder(d300, HENE_WAVELENGTH)).toBe(5)
    // Exactly at grazing emergence the order does not propagate.
    expect(highestOrder(nm(1000), nm(500))).toBe(1)
  })

  it('moves the orders outward for longer wavelengths and finer gratings', () => {
    expect(orderPosition(1, d300, nm(543.5), cm(25))!).toBeCloseTo(mm(41.315), 6)
    expect(orderPosition(1, d300, nm(543.5), cm(25))!).toBeLessThan(orderPosition(1, d300, HENE_WAVELENGTH, cm(25))!)
    expect(orderPosition(1, gratingPeriod(perMm(600)), HENE_WAVELENGTH, cm(25))!).toBeGreaterThan(orderPosition(1, d300, HENE_WAVELENGTH, cm(25))!)
  })

  it('recovers the wavelength from an order position without the small-angle approximation', () => {
    const y = orderPosition(2, d300, HENE_WAVELENGTH, cm(25))!
    expect(wavelengthFromOrder(y, cm(25), 2, d300)).toBeCloseTo(HENE_WAVELENGTH, 15)
    // The small-angle formula λ ≈ d y / (m L) would be 8 % too large here.
    expect((d300 * y) / (2 * cm(25)) / HENE_WAVELENGTH).toBeGreaterThan(1.08)
  })

  it('gives the amplitude-grating efficiencies (a/d)² sinc²(π m a/d)', () => {
    expect(orderEfficiency(0, 0.3)).toBeCloseTo(0.09, 12)
    expect(orderEfficiency(1, 0.3) / orderEfficiency(0, 0.3)).toBeCloseTo(0.73684, 5)
    expect(orderEfficiency(2, 0.3) / orderEfficiency(0, 0.3)).toBeCloseTo(0.25457, 5)
    expect(orderEfficiency(-2, 0.3)).toBeCloseTo(orderEfficiency(2, 0.3), 15)
    // A half-open grating has no even orders.
    expect(orderEfficiency(2, 0.5)).toBeCloseTo(0, 12)
    // Total transmitted power equals the open fraction.
    let total = 0
    for (let m = -4000; m <= 4000; m++) total += orderEfficiency(m, 0.3)
    expect(total).toBeCloseTo(0.3, 4)
  })

  it('turns each order of a laser beam into a spot whose size follows Gaussian beam propagation', () => {
    const w0 = mm(0.405)
    const q = { re: cm(92), im: qAtWaist(w0, HENE_WAVELENGTH).im }
    const spots = laserOrderSpots({ period: d300, wavelength: HENE_WAVELENGTH, openFraction: 0.3, q, distance: cm(25), maxOrder: 12 })
    expect(spots.map((s) => s.order)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5])
    const zero = spots.find((s) => s.order === 0)!
    const first = spots.find((s) => s.order === 1)!
    // Zeroth order: the undeviated beam, 117 cm from its waist.
    expect(zero.position).toBe(0)
    expect(zero.radiusAlong).toBeCloseTo(mm(0.70896), 7)
    expect(zero.radiusAcross).toBeCloseTo(zero.radiusAlong, 12)
    expect(first.position).toBeCloseTo(mm(48.339), 6)
    expect(first.radiusAlong).toBeCloseTo(mm(0.71475), 7)
    expect(first.radiusAcross).toBeCloseTo(mm(0.71086), 7)
    expect(zero.level).toBe(1)
    expect(first.level).toBeCloseTo((0.73684 * zero.radiusAlong * zero.radiusAcross) / (first.radiusAlong * first.radiusAcross), 4)
  })

  it('reduces to w² + (λL / (π w cos³θ))² for a waist at the grating', () => {
    const w = mm(0.5)
    const L = cm(40)
    const spots = laserOrderSpots({ period: d300, wavelength: HENE_WAVELENGTH, openFraction: 0.3, q: qAtWaist(w, HENE_WAVELENGTH), distance: L, maxOrder: 2 })
    for (const spot of spots) {
      const spread = (HENE_WAVELENGTH * L) / (Math.PI * w * Math.cos(spot.angle) ** 3)
      expect(spot.radiusAlong).toBeCloseTo(Math.hypot(w, spread), 10)
    }
  })

  it('evaluates the trapezoid as a unit-area convolution of two boxes', () => {
    expect(trapezoid(0, 4, 2)).toBeCloseTo(0.25, 12)
    expect(trapezoid(1, 4, 2)).toBeCloseTo(0.25, 12)
    expect(trapezoid(2, 4, 2)).toBeCloseTo(0.125, 12)
    expect(trapezoid(3, 4, 2)).toBe(0)
    let area = 0
    for (let i = 0; i < 6000; i++) area += trapezoid(-3 + (i + 0.5) * 0.001, 4, 2) * 0.001
    expect(area).toBeCloseTo(1, 6)
    expect(trapezoid(0.4, 1, 0)).toBe(1)
  })

  describe('white light', () => {
    const build = (aperture: number) =>
      buildGratingSpectrum({
        period: d300,
        openFraction: 0.3,
        lines: blackbodySpectrum(2900, 100),
        distance: cm(25),
        aperture,
        referenceAperture: mm(10),
        wavefrontRadius: cm(95),
        sourceB: cm(95),
        sourceSize: mm(4),
        power: 1,
        maxOrder: 12,
      })
    const at = (pattern: ReturnType<typeof build>, x: number) => {
      const s = pattern.sample(x, 1, 1)
      return { r: s.rgb[0], g: s.rgb[1], b: s.rgb[2], intensity: s.intensity[0] }
    }

    it('has a white zeroth order of unit brightness and is symmetric', () => {
      const pattern = build(mm(10))
      const centre = at(pattern, 0)
      expect(Math.max(centre.r, centre.g, centre.b)).toBeCloseTo(1, 6)
      expect(centre.intensity).toBeCloseTo(1, 6)
      expect(at(pattern, mm(40)).intensity).toBeCloseTo(at(pattern, -mm(40)).intensity, 6)
    })

    it('sends red farther from the axis than blue in the first order', () => {
      const pattern = build(mm(1))
      // 450 nm lands at 34.0 mm, 650 nm at 49.7 mm.
      const blueSide = at(pattern, mm(34))
      const redSide = at(pattern, mm(52))
      expect(blueSide.b).toBeGreaterThan(blueSide.r)
      expect(redSide.r).toBeGreaterThan(redSide.b)
    })

    it('is dimmer in proportion to the open width when the aperture is narrowed', () => {
      const wide = at(build(mm(10)), mm(42)).intensity
      const narrow = at(build(mm(5)), mm(42)).intensity
      expect(narrow / wide).toBeCloseTo(0.5, 1)
    })

    it('fills the geometric shadow of the aperture in the zeroth order', () => {
      // Aperture patch 10 mm × (1 + 25/95) = 12.63 mm, source smear 4 mm × 25/95 = 1.05 mm.
      const pattern = build(mm(10))
      expect(at(pattern, mm(5.5)).intensity).toBeCloseTo(1, 6)
      // Beyond the edge only the far tails of near-grazing orders remain.
      expect(at(pattern, mm(7.0)).intensity).toBeLessThan(1e-5)
    })
  })
})

describe('circular aperture (Airy pattern)', () => {
  it('evaluates J₁ against tabulated values', () => {
    expect(besselJ1(0)).toBe(0)
    expect(besselJ1(1)).toBeCloseTo(0.4400505857, 9)
    expect(besselJ1(2)).toBeCloseTo(0.5767248078, 9)
    expect(besselJ1(5)).toBeCloseTo(-0.3275791376, 9)
    expect(besselJ1(10)).toBeCloseTo(0.0434727462, 9)
    expect(besselJ1(15)).toBeCloseTo(0.2051040386, 7)
    expect(besselJ1(20)).toBeCloseTo(0.0668331242, 7)
    expect(besselJ1(-2)).toBeCloseTo(-0.5767248078, 9)
    // Continuous across the switch from the series to the asymptotic expansion.
    expect(besselJ1(12.000001)).toBeCloseTo(besselJ1(11.999999), 6)
  })

  it('has zeros of J₁ at 3.8317 and 7.0156', () => {
    expect(besselJ1(3.8317059702)).toBeCloseTo(0, 9)
    expect(besselJ1(7.0155866698)).toBeCloseTo(0, 9)
    expect(AIRY_FIRST_ZERO).toBeCloseTo(1.21967, 5)
  })

  it('is 1 on the axis, dark at 1.22 λ/D and 1.75 % in the first bright ring', () => {
    const D = mm(0.2)
    expect(airyIntensity(D, HENE_WAVELENGTH, 0)).toBeCloseTo(1, 12)
    expect(airyIntensity(D, HENE_WAVELENGTH, (AIRY_FIRST_ZERO * HENE_WAVELENGTH) / D)).toBeCloseTo(0, 12)
    // Maximum of the first ring at x = 5.1356.
    expect(airyIntensity(D, HENE_WAVELENGTH, (5.1356223 * HENE_WAVELENGTH) / (Math.PI * D))).toBeCloseTo(0.0175, 4)
    // Half maximum at x = 1.6163 (FWHM = 1.029 λ/D).
    expect(airyIntensity(D, HENE_WAVELENGTH, (1.61634 * HENE_WAVELENGTH) / (Math.PI * D))).toBeCloseTo(0.5, 4)
  })

  it('scales the pattern as λ / D', () => {
    expect(airyDiscRadius(mm(0.2), HENE_WAVELENGTH, cm(110))).toBeCloseTo(mm(4.2449), 7)
    expect(airyDiscRadius(mm(0.1), HENE_WAVELENGTH, cm(110))).toBeCloseTo(2 * airyDiscRadius(mm(0.2), HENE_WAVELENGTH, cm(110)), 12)
    expect(airyFirstZeroAngle(mm(0.2), HENE_WAVELENGTH)!).toBeCloseTo(Math.asin((1.21967 * 632.8e-9) / 0.2e-3), 8)
    expect(airyFirstZeroAngle(nm(500), HENE_WAVELENGTH)).toBeNull()
  })

  it('recovers the diameter from the first dark ring', () => {
    const ring = 2 * airyDiscRadius(mm(0.2), HENE_WAVELENGTH, cm(110))
    expect(apertureFromDarkRing(ring, HENE_WAVELENGTH, cm(110))).toBeCloseTo(mm(0.2), 12)
  })
})

describe('polarisers', () => {
  it('transmits half of unpolarised light whatever the axis', () => {
    for (const angle of [0, 0.3, 1.2, 2.9]) expect(polarizerChain([angle]).transmission).toBeCloseTo(0.5, 15)
  })

  it("follows Malus's law", () => {
    expect(malusTransmission(degToRad(60))).toBeCloseTo(0.25, 12)
    expect(polarizerChain([0, degToRad(60)]).transmission).toBeCloseTo(0.125, 12)
    expect(polarizerChain([0, degToRad(30)]).transmission).toBeCloseTo(0.375, 12)
    expect(polarizerChain([degToRad(20), degToRad(20)]).transmission).toBeCloseTo(0.5, 12)
    // Only the angle between the axes matters.
    expect(polarizerChain([degToRad(70), degToRad(100)]).transmission).toBeCloseTo(0.375, 12)
  })

  it('blocks all light between crossed polarisers, and passes 1/8 with a third at 45° between them', () => {
    expect(polarizerChain([0, Math.PI / 2]).transmission).toBeCloseTo(0, 15)
    expect(polarizerChain([0, Math.PI / 4, Math.PI / 2]).transmission).toBeCloseTo(0.125, 12)
  })

  it('reports the cumulative fraction after each polariser and the final polarisation', () => {
    const chain = polarizerChain([0, degToRad(30)])
    expect(chain.stages[0]).toBeCloseTo(0.5, 12)
    expect(chain.stages[1]).toBeCloseTo(0.375, 12)
    expect(chain.state).toEqual({ kind: 'linear', angle: degToRad(30) })
    expect(polarizerChain([]).transmission).toBe(1)
  })
})

describe('dispersion', () => {
  it('reproduces the catalogue index n_d and Abbe number of each glass', () => {
    const catalogue: Record<string, [number, number]> = {
      bk7: [1.5168, 64.17],
      f2: [1.62004, 36.37],
      sf10: [1.72828, 28.53],
      silica: [1.45846, 67.82],
    }
    for (const glass of OPTICAL_GLASSES) {
      const [nd, vd] = catalogue[glass.id]
      expect(refractiveIndex(glass, nm(587.5618))).toBeCloseTo(nd, 4)
      expect(abbeNumber(glass)).toBeCloseTo(vd, 1)
    }
  })

  it('has normal dispersion: the index falls with wavelength across the visible', () => {
    for (const glass of OPTICAL_GLASSES) {
      let previous = Infinity
      for (let lambda = 400; lambda <= 700; lambda += 25) {
        const n = refractiveIndex(glass, nm(lambda))
        expect(n).toBeLessThan(previous)
        previous = n
      }
    }
    expect(refractiveIndex(opticalGlass('bk7'), HENE_WAVELENGTH)).toBeCloseTo(1.51509, 5)
  })
})

describe('prism', () => {
  const A = degToRad(60)
  const n = 1.51509 // BK7 at 632.8 nm

  it('gives the minimum deviation 2 sin⁻¹(n sin(A/2)) − A at symmetric passage', () => {
    expect(radToDeg(incidenceAtMinimumDeviation(A, n)!)).toBeCloseTo(49.248, 2)
    expect(radToDeg(minimumDeviation(A, n)!)).toBeCloseTo(38.496, 2)
    const s = solvePrism({ apexAngle: A, incidenceAngle: incidenceAtMinimumDeviation(A, n)!, index: n })
    expect(s.outcome).toBe('transmitted')
    expect(s.deviation!).toBeCloseTo(minimumDeviation(A, n)!, 12)
    expect(s.emergenceAngle!).toBeCloseTo(incidenceAtMinimumDeviation(A, n)!, 12)
    expect(s.refractionAngle1).toBeCloseTo(A / 2, 12)
    expect(s.incidenceAngle2!).toBeCloseTo(A / 2, 12)
    // Inside, the ray runs parallel to the base.
    expect(s.inside.y).toBeCloseTo(0, 12)
  })

  it('obeys δ = θ₁ + θ₂ − A and θ₁′ + θ₂′ = A at any incidence', () => {
    for (const degrees of [35, 40, 55, 60, 75, 85]) {
      const theta1 = degToRad(degrees)
      const s = solvePrism({ apexAngle: A, incidenceAngle: theta1, index: n })
      expect(s.outcome).toBe('transmitted')
      expect(s.deviation!).toBeCloseTo(theta1 + s.emergenceAngle! - A, 12)
      expect(s.refractionAngle1 + s.incidenceAngle2!).toBeCloseTo(A, 12)
      expect(Math.sin(theta1)).toBeCloseTo(n * Math.sin(s.refractionAngle1), 12)
      expect(Math.sin(s.emergenceAngle!)).toBeCloseTo(n * Math.sin(s.incidenceAngle2!), 12)
    }
    expect(radToDeg(solvePrism({ apexAngle: A, incidenceAngle: degToRad(60), index: n }).deviation!)).toBeCloseTo(40.0617, 3)
    expect(radToDeg(solvePrism({ apexAngle: A, incidenceAngle: degToRad(40), index: n }).deviation!)).toBeCloseTo(40.0857, 3)
  })

  it('has larger deviation on either side of the symmetric passage', () => {
    const minimum = minimumDeviation(A, n)!
    const symmetric = incidenceAtMinimumDeviation(A, n)!
    for (const offset of [-10, -3, -0.5, 0.5, 3, 10]) {
      const s = solvePrism({ apexAngle: A, incidenceAngle: symmetric + degToRad(offset), index: n })
      expect(s.deviation!).toBeGreaterThan(minimum)
    }
  })

  it('recovers the index from the minimum deviation', () => {
    expect(indexFromMinimumDeviation(A, minimumDeviation(A, n)!)).toBeCloseTo(n, 12)
    expect(indexFromMinimumDeviation(A, degToRad(38.5))).toBeCloseTo(1.5151, 3)
  })

  it('deviates blue light more than red', () => {
    const glass = opticalGlass('bk7')
    const deviation = (lambda: number) =>
      solvePrism({ apexAngle: A, incidenceAngle: degToRad(50), index: refractiveIndex(glass, nm(lambda)) }).deviation!
    expect(deviation(450)).toBeGreaterThan(deviation(650))
    // Dense flint spreads the colours more than crown.
    const flint = (lambda: number) =>
      solvePrism({ apexAngle: A, incidenceAngle: degToRad(62), index: refractiveIndex(opticalGlass('sf10'), nm(lambda)) }).deviation!
    expect(flint(450) - flint(650)).toBeGreaterThan(deviation(450) - deviation(650))
  })

  it('reports total internal reflection at the second face instead of an emergent ray', () => {
    const s = solvePrism({ apexAngle: A, incidenceAngle: degToRad(20), index: n })
    expect(s.outcome).toBe('total-internal-reflection')
    expect(s.emergent).toBeNull()
    expect(s.deviation).toBeNull()
    expect(s.transmittance).toBe(0)
    expect(s.internalReflection).not.toBeNull()
    // Internal incidence 60° − 13.05° = 46.95° exceeds the critical angle 41.30°.
    expect(radToDeg(s.incidenceAngle2!)).toBeCloseTo(46.95, 1)
  })

  it('keeps the exit point on the second face and conserves energy', () => {
    const s = solvePrism({ apexAngle: A, incidenceAngle: degToRad(50), index: n })
    const [apex, , right] = s.vertices
    const t = (s.exit.x - apex.x) / (right.x - apex.x)
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(1)
    expect((s.exit.y - apex.y) / (right.y - apex.y)).toBeCloseTo(t, 12)
    // Unpolarised Fresnel loss of 5.85 % at each face near symmetric passage.
    expect(s.transmittance).toBeCloseTo(0.886, 2)
  })

  it('has no symmetric passage when n sin(A/2) ≥ 1', () => {
    expect(minimumDeviation(degToRad(100), 1.6)).toBeNull()
  })
})

describe('polarisation at an interface (Brewster)', () => {
  const setup = (degrees: number, polarization: 'unpolarized' | 's' | 'p') =>
    solveSurface({ kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(90 + degrees), medium1: 'air', medium2: 'crown', polarization })

  it('reflects 4.2 % at normal incidence for every polarisation', () => {
    for (const polarization of ['unpolarized', 's', 'p'] as const) {
      expect(setup(0, polarization).reflectance).toBeCloseTo(0.042107, 5)
    }
  })

  it('reflects no p-polarised light at tan⁻¹(n₂/n₁)', () => {
    const thetaB = brewsterAngle(1.000293, 1.5168)
    expect(radToDeg(thetaB)).toBeCloseTo(56.596, 3)
    const s = setup(radToDeg(thetaB), 'p')
    expect(s.brewsterAngle!).toBeCloseTo(thetaB, 12)
    expect(s.reflectance).toBeCloseTo(0, 12)
    expect(s.transmittance).toBeCloseTo(1, 12)
    // Reflected and refracted rays are perpendicular.
    expect(s.incidentAngle + s.refractedAngle!).toBeCloseTo(Math.PI / 2, 10)
    expect(setup(radToDeg(thetaB), 's').reflectance).toBeGreaterThan(0.14)
    expect(indexFromBrewsterAngle(1.000293, thetaB)).toBeCloseTo(1.5168, 12)
  })

  it('uses Rs, Rp or their mean according to the polarisation, conserving energy', () => {
    const s = setup(45, 's')
    const p = setup(45, 'p')
    const u = setup(45, 'unpolarized')
    expect(s.reflectance).toBeCloseTo(s.reflectanceS!, 15)
    expect(p.reflectance).toBeCloseTo(p.reflectanceP!, 15)
    expect(u.reflectance).toBeCloseTo((s.reflectance + p.reflectance) / 2, 15)
    expect(s.reflectance).toBeGreaterThan(p.reflectance)
    // At 45° incidence Rp = Rs² exactly.
    expect(p.reflectance).toBeCloseTo(s.reflectance ** 2, 12)
    for (const solution of [s, p, u]) expect(solution.reflectance + solution.transmittance).toBeCloseTo(1, 15)
  })

  it('treats an omitted polarisation as unpolarised', () => {
    const plain = solveSurface({ kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(130), medium1: 'air', medium2: 'water' })
    const explicit = solveSurface({ kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(130), medium1: 'air', medium2: 'water', polarization: 'unpolarized' })
    expect(plain.reflectance).toBe(explicit.reflectance)
  })
})
