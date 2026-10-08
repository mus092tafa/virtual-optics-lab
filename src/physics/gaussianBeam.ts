/**
 * Wave optics: propagation of a TEM00 Gaussian laser beam (paraxial).
 *
 * The beam is described by the complex parameter q:
 *   1/q = 1/R − i λ / (π w²)
 * with R the wavefront radius of curvature and w the 1/e² intensity radius.
 * Free space:  q' = q + d.   Thin lens:  1/q' = 1/q − 1/f.
 */
import { lensesBetween } from './rayTransfer'
import type { AxialLens } from './rayTransfer'

export interface Complex {
  re: number
  im: number
}

/** Rayleigh range z_R = π w₀² / λ. */
export function rayleighRange(waistRadius: number, wavelength: number): number {
  return (Math.PI * waistRadius * waistRadius) / wavelength
}

/** Far-field half-angle divergence θ = λ / (π w₀). */
export function divergenceHalfAngle(waistRadius: number, wavelength: number): number {
  return wavelength / (Math.PI * waistRadius)
}

/** Free-space beam radius a distance z from a waist: w(z) = w₀ √(1 + (z/z_R)²). */
export function beamRadiusFromWaist(waistRadius: number, wavelength: number, z: number): number {
  const zr = rayleighRange(waistRadius, wavelength)
  return waistRadius * Math.sqrt(1 + (z / zr) ** 2)
}

export function qAtWaist(waistRadius: number, wavelength: number): Complex {
  return { re: 0, im: rayleighRange(waistRadius, wavelength) }
}

export function propagateQ(q: Complex, distance: number): Complex {
  return { re: q.re + distance, im: q.im }
}

function inverse(q: Complex): Complex {
  const magnitude = q.re * q.re + q.im * q.im
  return { re: q.re / magnitude, im: -q.im / magnitude }
}

export function lensQ(q: Complex, focalLength: number): Complex {
  const inv = inverse(q)
  return inverse({ re: inv.re - 1 / focalLength, im: inv.im })
}

/** 1/e² intensity radius. */
export function beamRadius(q: Complex, wavelength: number): number {
  return Math.sqrt(-wavelength / (Math.PI * inverse(q).im))
}

/** Wavefront radius of curvature (positive = diverging, Infinity = plane). */
export function wavefrontRadius(q: Complex): number {
  const curvature = inverse(q).re
  return Math.abs(curvature) < 1e-12 ? Infinity : 1 / curvature
}

export interface BeamSample {
  x: number
  /** 1/e² intensity radius. */
  w: number
}

export interface BeamWaist {
  x: number
  radius: number
}

export interface BeamPath {
  wavelength: number
  samples: BeamSample[]
  /** Waists that physically occur inside free-space sections of the path. */
  waists: BeamWaist[]
  /** Beam parameter at the end plane. */
  qEnd: Complex
  radiusAtEnd: number
}

/**
 * Propagates a Gaussian beam whose waist sits at xStart through the thin
 * lenses lying between xStart and xEnd.
 */
export function propagateBeam(
  lenses: readonly AxialLens[],
  wavelength: number,
  waistRadius: number,
  xStart: number,
  xEnd: number,
  samplesPerSection = 48,
): BeamPath {
  const samples: BeamSample[] = []
  const waists: BeamWaist[] = [{ x: xStart, radius: waistRadius }]
  let q = qAtWaist(waistRadius, wavelength)
  let x = xStart

  const section = (xTo: number) => {
    const length = xTo - x
    if (length <= 0) return
    // A waist lies in this section when the beam is converging (Re q < 0).
    const waistOffset = -q.re
    if (waistOffset > 0 && waistOffset < length) {
      waists.push({ x: x + waistOffset, radius: Math.sqrt((wavelength * q.im) / Math.PI) })
    }
    for (let i = 0; i <= samplesPerSection; i++) {
      const offset = (length * i) / samplesPerSection
      samples.push({ x: x + offset, w: beamRadius(propagateQ(q, offset), wavelength) })
    }
    if (waistOffset > 0 && waistOffset < length) {
      samples.push({ x: x + waistOffset, w: beamRadius(propagateQ(q, waistOffset), wavelength) })
      samples.sort((a, b) => a.x - b.x)
    }
    q = propagateQ(q, length)
    x = xTo
  }

  for (const lens of lensesBetween(lenses, xStart, xEnd)) {
    section(lens.x)
    q = lensQ(q, lens.focalLength)
  }
  section(xEnd)
  if (samples.length === 0) samples.push({ x: xStart, w: waistRadius })
  return { wavelength, samples, waists, qEnd: q, radiusAtEnd: beamRadius(q, wavelength) }
}
