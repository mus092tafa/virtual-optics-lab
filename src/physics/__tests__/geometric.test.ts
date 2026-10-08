import { describe, expect, it } from 'vitest'
import { MATERIALS, material } from '../constants'
import {
  blurCircleDiameter,
  focalLengthFromConjugates,
  imageDistance,
  principalRays,
  thinLensImage,
} from '../lenses'
import { projectOntoScreen, sequentialImaging, systemMatrix, traceRay } from '../rayTransfer'
import { angleFromNormal, reflectVector, reflectedRayRotation, reflectionAngle } from '../reflection'
import { brewsterAngle, criticalAngle, fresnel, indexFromAngles, refractVector, refractionAngle } from '../refraction'
import { solveSurface } from '../surface'
import { cm, convertLength, degToRad, fromMeters, mm, nm, radToDeg, toMeters } from '../units'

describe('units', () => {
  it('converts between length units', () => {
    expect(nm(632.8)).toBeCloseTo(6.328e-7, 15)
    expect(convertLength(632.8, 'nm', 'mm')).toBeCloseTo(0.0006328, 12)
    expect(fromMeters(cm(30), 'mm')).toBeCloseTo(300, 9)
    expect(toMeters(1, 'm')).toBe(1)
  })
  it('converts angles', () => {
    expect(radToDeg(degToRad(37.5))).toBeCloseTo(37.5, 12)
  })
})

describe('reflection', () => {
  it('θr = θi for 30°', () => {
    expect(radToDeg(reflectionAngle(degToRad(30)))).toBeCloseTo(30, 12)
  })
  it('vector reflection gives equal angles for any incidence and mirror tilt', () => {
    for (const tiltDeg of [-40, 0, 25]) {
      for (const incidenceDeg of [0, 10, 30, 45, 60, 85]) {
        const solution = solveSurface({
          kind: 'mirror',
          surfaceTilt: degToRad(tiltDeg),
          sourceAngle: degToRad(90 + tiltDeg + incidenceDeg),
          medium1: 'air',
          medium2: 'air',
        })
        expect(radToDeg(solution.incidentAngle)).toBeCloseTo(incidenceDeg, 9)
        expect(radToDeg(solution.reflectedAngle!)).toBeCloseTo(incidenceDeg, 9)
      }
    }
  })
  it('reflected ray lies on the other side of the normal', () => {
    const normal = { x: 0, y: 1 }
    const reflected = reflectVector({ x: Math.sin(0.5), y: -Math.cos(0.5) }, normal)
    expect(reflected.x).toBeCloseTo(Math.sin(0.5), 12)
    expect(reflected.y).toBeCloseTo(Math.cos(0.5), 12)
    expect(angleFromNormal(reflected, normal)).toBeCloseTo(0.5, 12)
  })
  it('rotating the mirror by α rotates the reflected ray by 2α', () => {
    const alpha = degToRad(7)
    const sourceAngle = degToRad(120)
    const direction = (tilt: number) => {
      const r = solveSurface({ kind: 'mirror', surfaceTilt: tilt, sourceAngle, medium1: 'air', medium2: 'air' }).reflected!
      return Math.atan2(r.y, r.x)
    }
    expect(direction(alpha) - direction(0)).toBeCloseTo(reflectedRayRotation(alpha), 12)
  })
  it('light arriving at the back of the mirror is not reflected', () => {
    const s = solveSurface({ kind: 'mirror', surfaceTilt: 0, sourceAngle: degToRad(-60), medium1: 'air', medium2: 'air' })
    expect(s.reflected).toBeNull()
  })
})

describe('refraction', () => {
  it("satisfies Snell's law for known indices", () => {
    // Air -> water at 45°: θ2 = asin(sin45° / 1.333) = 32.0°
    const theta2 = refractionAngle(1.0, 1.333, degToRad(45))!
    expect(radToDeg(theta2)).toBeCloseTo(32.03, 1)
    // Air -> crown glass (n = 1.5) at 30°: 19.47°
    expect(radToDeg(refractionAngle(1, 1.5, degToRad(30))!)).toBeCloseTo(19.471, 3)
  })
  it('n1 sinθ1 = n2 sinθ2 for every material pair', () => {
    for (const a of MATERIALS) {
      for (const b of MATERIALS) {
        for (const deg of [5, 20, 35]) {
          const theta1 = degToRad(deg)
          const theta2 = refractionAngle(a.n, b.n, theta1)
          if (theta2 === null) continue
          expect(a.n * Math.sin(theta1)).toBeCloseTo(b.n * Math.sin(theta2), 12)
          expect(indexFromAngles(a.n, theta1, theta2)).toBeCloseTo(b.n, 10)
        }
      }
    }
  })
  it('bends towards the normal entering a denser medium and away leaving it', () => {
    expect(refractionAngle(1, 1.5, 0.6)!).toBeLessThan(0.6)
    expect(refractionAngle(1.5, 1, 0.6)!).toBeGreaterThan(0.6)
  })
  it('predicts total internal reflection beyond the critical angle', () => {
    const critical = criticalAngle(1.5, 1)!
    expect(radToDeg(critical)).toBeCloseTo(41.81, 2)
    expect(refractionAngle(1.5, 1, critical + 0.01)).toBeNull()
    expect(refractionAngle(1.5, 1, critical - 0.01)).not.toBeNull()
    expect(criticalAngle(1, 1.5)).toBeNull()
    expect(fresnel(1.5, 1, critical + 0.01).R).toBe(1)
  })
  it('vector refraction agrees with the scalar law', () => {
    const theta1 = degToRad(40)
    const d = { x: Math.sin(theta1), y: -Math.cos(theta1) }
    const t = refractVector(d, { x: 0, y: 1 }, 1, 1.333)!
    expect(Math.atan2(t.x, -t.y)).toBeCloseTo(refractionAngle(1, 1.333, theta1)!, 12)
    expect(Math.hypot(t.x, t.y)).toBeCloseTo(1, 12)
  })
  it('Fresnel: 4% reflection at normal incidence on glass, energy conserved, zero Rp at Brewster', () => {
    expect(fresnel(1, 1.5, 0).R).toBeCloseTo(0.04, 10)
    const f = fresnel(1, 1.5, degToRad(50))
    expect(f.R + f.T).toBeCloseTo(1, 12)
    expect(fresnel(1, 1.5, brewsterAngle(1, 1.5)).Rp).toBeCloseTo(0, 12)
  })
  it('surface solver handles light travelling from medium 2 into medium 1', () => {
    // Source below a horizontal air/glass interface: glass -> air.
    const s = solveSurface({ kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(-90 + 30), medium1: 'air', medium2: 'crown' })
    expect(s.fromFront).toBe(false)
    expect(s.nIncident).toBe(material('crown').n)
    expect(material('crown').n * Math.sin(s.incidentAngle)).toBeCloseTo(material('air').n * Math.sin(s.refractedAngle!), 10)
    const tir = solveSurface({ kind: 'interface', surfaceTilt: 0, sourceAngle: degToRad(-90 + 50), medium1: 'air', medium2: 'crown' })
    expect(tir.totalInternalReflection).toBe(true)
    expect(tir.reflectance).toBe(1)
  })
})

describe('thin lens', () => {
  it('f = 10 cm, do = 30 cm gives di = 15 cm and m = −0.5', () => {
    const image = thinLensImage(cm(10), cm(30))
    expect(fromMeters(image.imageDistance, 'cm')).toBeCloseTo(15, 10)
    expect(image.magnification).toBeCloseTo(-0.5, 10)
    expect(image.isReal).toBe(true)
    expect(image.orientation).toBe('inverted')
    expect(image.size).toBe('reduced')
  })
  it('classifies the standard cases', () => {
    expect(thinLensImage(cm(10), cm(20)).magnification).toBeCloseTo(-1, 10)
    expect(thinLensImage(cm(10), cm(20)).size).toBe('same size')
    const magnified = thinLensImage(cm(10), cm(15))
    expect(magnified.imageDistance).toBeCloseTo(cm(30), 10)
    expect(magnified.size).toBe('magnified')
    const virtual = thinLensImage(cm(10), cm(5))
    expect(virtual.imageDistance).toBeCloseTo(cm(-10), 10)
    expect(virtual.isReal).toBe(false)
    expect(virtual.orientation).toBe('upright')
    expect(virtual.magnification).toBeCloseTo(2, 10)
    expect(thinLensImage(cm(10), cm(10)).atInfinity).toBe(true)
  })
  it('recovers the focal length from conjugate distances', () => {
    for (const f of [5, 10, 15, 20, 30]) {
      for (const d of [f * 1.3, f * 2, f * 4]) {
        expect(focalLengthFromConjugates(cm(d), imageDistance(cm(f), cm(d)))).toBeCloseTo(cm(f), 12)
      }
    }
  })
  it('principal rays all meet at the calculated image point', () => {
    const lensX = cm(40)
    const objectX = cm(10)
    const height = mm(20)
    const image = thinLensImage(cm(10), lensX - objectX)
    const imageX = lensX + image.imageDistance
    const rays = principalRays(lensX, cm(10), objectX, height, cm(100))
    expect(rays.map((r) => r.kind)).toEqual(['parallel', 'central', 'focal'])
    for (const ray of rays) {
      const { from, to } = ray.outgoing
      const slope = (to.y - from.y) / (to.x - from.x)
      expect(from.y + slope * (imageX - from.x)).toBeCloseTo(image.magnification * height, 12)
      // The incoming segment starts at the object tip and ends on the lens plane.
      expect(ray.incoming.from).toEqual({ x: objectX, y: height })
      expect(ray.incoming.to.x).toBe(lensX)
      expect(ray.incoming.to.y).toBeCloseTo(from.y, 12)
    }
    // Parallel ray crosses the axis at the back focal point; focal ray passes the front one.
    const parallel = rays[0].outgoing
    const slope = (parallel.to.y - parallel.from.y) / (parallel.to.x - parallel.from.x)
    expect(parallel.from.y + slope * cm(10)).toBeCloseTo(0, 12)
    const focal = rays[2].incoming
    const fSlope = (focal.to.y - focal.from.y) / (focal.to.x - focal.from.x)
    expect(focal.from.y + fSlope * (lensX - cm(10) - objectX)).toBeCloseTo(0, 12)
    expect(rays[2].outgoing.to.y).toBeCloseTo(rays[2].outgoing.from.y, 12)
  })
  it('principal rays of a virtual image extend back to the virtual image point', () => {
    const rays = principalRays(cm(40), cm(10), cm(35), mm(10), cm(80))
    for (const ray of rays) {
      expect(ray.virtualExtension!.to.x).toBeCloseTo(cm(30), 12)
      expect(ray.virtualExtension!.to.y).toBeCloseTo(mm(20), 12)
      // Extension is collinear with the outgoing ray.
      const o = ray.outgoing
      const slope = (o.to.y - o.from.y) / (o.to.x - o.from.x)
      expect(o.from.y + slope * (cm(30) - o.from.x)).toBeCloseTo(mm(20), 12)
    }
  })
})

describe('screen focus (defocus blur)', () => {
  const f = cm(10)
  const d = cm(20) // image at 20 cm
  it('blur is zero at the image plane and grows away from it', () => {
    expect(blurCircleDiameter(mm(40), f, d, cm(20))).toBeCloseTo(0, 12)
    // Screen at 25 cm: c = D |s − di| / di = 40 mm × 5/20 = 10 mm
    expect(blurCircleDiameter(mm(40), f, d, cm(25))).toBeCloseTo(mm(10), 12)
    expect(blurCircleDiameter(mm(40), f, d, cm(15))).toBeCloseTo(mm(10), 12)
    expect(blurCircleDiameter(mm(40), f, d, cm(30))).toBeGreaterThan(blurCircleDiameter(mm(40), f, d, cm(25)))
  })
  it('blur scales with the lens aperture', () => {
    expect(blurCircleDiameter(mm(20), f, d, cm(25))).toBeCloseTo(mm(5), 12)
  })
  it('ray-matrix projection agrees with the thin-lens formulas', () => {
    const lens = { x: cm(50), focalLength: f, aperture: mm(40) }
    const sharp = projectOntoScreen([lens], cm(30), cm(70))!
    expect(sharp.blurDiameter).toBeCloseTo(0, 12)
    expect(sharp.scale).toBeCloseTo(-1, 12)
    const blurred = projectOntoScreen([lens], cm(30), cm(75))!
    expect(blurred.blurDiameter).toBeCloseTo(blurCircleDiameter(mm(40), f, d, cm(25)), 12)
    // The chief ray goes straight through the lens centre: scale = −s/do.
    expect(blurred.scale).toBeCloseTo(-25 / 20, 12)
  })
})

describe('ray-transfer matrices and compound systems', () => {
  it('single lens matrix has B = 0 at the image plane and A = m', () => {
    const [A, B, C] = systemMatrix([{ x: cm(30), focalLength: cm(10), aperture: mm(40) }], 0, cm(45))
    expect(B).toBeCloseTo(0, 12)
    expect(A).toBeCloseTo(-0.5, 12)
    expect(C).toBeCloseTo(-10, 12)
  })
  it('two-lens system: sequential thin-lens imaging matches the system matrix', () => {
    const lenses = [
      { x: cm(30), focalLength: cm(10), aperture: mm(40) },
      { x: cm(65), focalLength: cm(5), aperture: mm(40) },
    ]
    const result = sequentialImaging(lenses, 0)!
    // Lens 1: do=30 -> di=15 (x=45), m=−0.5. Lens 2: do=20 -> di=6.667, m=−1/3.
    expect(result.stages[0].imageX).toBeCloseTo(cm(45), 12)
    expect(result.stages[1].imageDistance).toBeCloseTo(cm(20 / 3), 12)
    expect(result.magnification).toBeCloseTo(1 / 6, 12)
    const [A, B] = systemMatrix(lenses, 0, result.imageX)
    expect(B).toBeCloseTo(0, 12)
    expect(A).toBeCloseTo(result.magnification, 12)
    expect(projectOntoScreen(lenses, 0, result.imageX)!.blurDiameter).toBeCloseTo(0, 12)
  })
  it('collimated intermediate beam (object at focus) is handled', () => {
    const lenses = [
      { x: cm(10), focalLength: cm(10), aperture: mm(40) },
      { x: cm(50), focalLength: cm(20), aperture: mm(40) },
    ]
    const result = sequentialImaging(lenses, 0)!
    expect(result.imageX).toBeCloseTo(cm(70), 12)
    expect(result.magnification).toBeCloseTo(-2, 12)
  })
  it('traced marginal rays cross the axis at the image', () => {
    const lens = { x: cm(30), focalLength: cm(10), aperture: mm(40) }
    const points = traceRay([lens], 0, cm(45), 0, 0.05)
    expect(points[1].y).toBeCloseTo(0.015, 12)
    expect(points[2].y).toBeCloseTo(0, 12)
  })
})
