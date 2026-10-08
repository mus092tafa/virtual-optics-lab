/**
 * Wave optics: Michelson interferometer.
 *
 * A laser beam is divided by a beam splitter into two arms, reflected by the
 * mirrors M1 (fixed) and M2 (movable, tiltable) and recombined on a screen.
 * Each arm delivers a Gaussian beam; with the "unfolded" path lengths
 *
 *   z₁ = source → splitter → M1 → splitter → screen
 *   z₂ = z₁ + 2d            (d: displacement of M2 from the equal-arm position)
 *
 * the two fields on the screen are
 *
 *   E_i(ρ) = a_i · exp(−ρ²/w_i²) · exp{ −i [k z_i + k ρ²/(2R_i)] }
 *
 * and the observed intensity is the two-beam interference
 *
 *   I = |E₁|² + |E₂|² + 2|E₁||E₂| cos Δφ
 *
 * A diverging beam (expander lens) gives wavefronts of different curvature and
 * hence circular fringes, 2d cos θ = mλ. Tilting M2 by α turns its beam by 2α
 * and gives straight fringes. Moving M2 by λ/2 shifts the pattern by one fringe.
 */
import { DEFAULT_LENS_APERTURE } from './constants'
import { rayleighRange } from './gaussianBeam'
import { systemMatrix } from './rayTransfer'
import type { AxialLens } from './rayTransfer'

export interface MichelsonSetup {
  wavelength: number
  /** 1/e² radius of the laser beam waist at the laser output. */
  waistRadius: number
  laserToLens: number
  /** Focal length of the beam-expanding lens; null when it is removed. */
  expanderFocalLength: number | null
  lensToSplitter: number
  /** Splitter-to-mirror distance of the fixed arm (M1). */
  armLength: number
  /** Displacement d of M2 from the equal-arm position (positive = longer arm). */
  mirrorDisplacement: number
  /** Tilt of M2 about the vertical / horizontal axis, radians. */
  tiltX: number
  tiltY: number
  splitterToScreen: number
}

export interface ArmBeam {
  /** Unfolded path length from the laser to the screen. */
  pathLength: number
  /** 1/e² intensity radius on the screen. */
  radius: number
  /** Wavefront curvature 1/R on the screen (0 = plane). */
  curvature: number
  /** On-axis amplitude relative to the laser waist, and its (Gouy) phase. */
  amplitude: number
  phase: number
}

export interface MichelsonSolution {
  wavelength: number
  /** Optical path difference 2d. */
  pathDifference: number
  /** Interference order at the centre of the screen, ≈ 2d/λ. */
  centreOrder: number
  /** Relative intensity at the centre (1 = fully constructive). */
  centreIntensity: number
  arms: [ArmBeam, ArmBeam]
  /** Spacing of the straight fringes caused by mirror tilt; Infinity when aligned. */
  tiltFringeSpacing: number
  /** Radius at which the order differs by one from the centre (scale of the rings). */
  ringScale: number
  /** Offset of the M2 beam on the screen caused by the tilt. */
  beamOffset: { x: number; y: number }
  /** Beam radius a distance z along the unfolded path from the laser. */
  beamRadiusAt(z: number): number
  /** Relative intensity at the screen position (u, v). */
  intensity(u: number, v: number): number
}

/**
 * Phase difference between the two arms at zero path difference: one beam is
 * reflected at the outside of the splitter coating (phase π), the other at
 * the inside (phase 0), so the centre is dark when the arms are equal.
 */
export const BEAM_SPLITTER_PHASE = Math.PI

/** Mirror displacement that moves the pattern by one fringe: λ/2. */
export function displacementPerFringe(wavelength: number): number {
  return wavelength / 2
}

/** Wavelength from counting N fringes while the mirror moves by Δd: λ = 2Δd / N. */
export function wavelengthFromFringeCount(displacement: number, fringes: number): number {
  return (2 * displacement) / fringes
}

/** Ideal fringe condition for equal-inclination rings: order m = 2d cos θ / λ. */
export function ringOrder(mirrorDisplacement: number, wavelength: number, angle: number): number {
  return (2 * mirrorDisplacement * Math.cos(angle)) / wavelength
}

export function solveMichelson(setup: MichelsonSetup): MichelsonSolution {
  const { wavelength, waistRadius, mirrorDisplacement: d } = setup
  const k = (2 * Math.PI) / wavelength
  const zR = rayleighRange(waistRadius, wavelength)
  const lenses: AxialLens[] =
    setup.expanderFocalLength === null
      ? []
      : [{ x: setup.laserToLens, focalLength: setup.expanderFocalLength, aperture: DEFAULT_LENS_APERTURE }]

  // Gaussian beam with waist q₀ = i z_R after a ray matrix (A, B, C, D):
  //   on-axis amplitude a = 1 / (A + B/q₀),   w = w₀ |A + B/q₀|,
  //   1/q = (C q₀ + D) / (A q₀ + B)  ->  curvature = Re(1/q)
  const beamAt = (z: number): ArmBeam => {
    const [A, B, C, D] = systemMatrix(lenses, 0, z)
    const spread = Math.hypot(A, B / zR)
    return {
      pathLength: z,
      radius: waistRadius * spread,
      curvature: (D * B + A * C * zR * zR) / (B * B + A * A * zR * zR),
      amplitude: 1 / spread,
      phase: Math.atan2(B / zR, A),
    }
  }

  const toSplitter = setup.laserToLens + setup.lensToSplitter
  const z1 = toSplitter + 2 * setup.armLength + setup.splitterToScreen
  const z2 = z1 + 2 * d
  const beam1 = beamAt(z1)
  const beam2 = beamAt(z2)

  // Tilting M2 by α rotates its beam by 2α about the mirror.
  const lever = setup.armLength + d + setup.splitterToScreen
  const angleX = 2 * setup.tiltX
  const angleY = 2 * setup.tiltY
  const offsetX = angleX * lever
  const offsetY = angleY * lever
  const axialPhase = -k * 2 * d + (beam2.phase - beam1.phase) + BEAM_SPLITTER_PHASE
  const norm = 1 / (4 * beam1.amplitude * beam1.amplitude)
  const inverseW1 = 1 / (beam1.radius * beam1.radius)
  const inverseW2 = 1 / (beam2.radius * beam2.radius)

  const intensity = (u: number, v: number): number => {
    const rho1 = u * u + v * v
    const du = u - offsetX
    const dv = v - offsetY
    const rho2 = du * du + dv * dv
    const e1 = beam1.amplitude * Math.exp(-rho1 * inverseW1)
    const e2 = beam2.amplitude * Math.exp(-rho2 * inverseW2)
    const phase = axialPhase - (k / 2) * (beam2.curvature * rho2 - beam1.curvature * rho1) - k * (angleX * u + angleY * v)
    return (e1 * e1 + e2 * e2 + 2 * e1 * e2 * Math.cos(phase)) * norm
  }

  // Gradient of the phase difference at the centre gives the tilt fringe spacing.
  const gradient = k * Math.hypot(angleX, angleY) * Math.abs(1 - beam2.curvature * lever)
  const curvatureDifference = Math.abs(beam2.curvature - beam1.curvature)

  return {
    wavelength,
    pathDifference: 2 * d,
    centreOrder: (k * 2 * d - (beam2.phase - beam1.phase)) / (2 * Math.PI),
    centreIntensity: intensity(0, 0),
    arms: [beam1, beam2],
    tiltFringeSpacing: gradient < 1e-9 ? Infinity : (2 * Math.PI) / gradient,
    ringScale: curvatureDifference < 1e-12 ? Infinity : Math.sqrt((2 * wavelength) / curvatureDifference),
    beamOffset: { x: offsetX, y: offsetY },
    beamRadiusAt: (z: number) => beamAt(z).radius,
    intensity,
  }
}
