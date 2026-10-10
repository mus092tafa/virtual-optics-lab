/**
 * Turns the numerical solution of the bench into labelled, formatted rows for
 * the physics panel. Presentation only: every number comes from the solver.
 */
import { TUNGSTEN_TEMPERATURE } from '../physics/constants'
import type { BenchSolution } from '../physics/optics'
import type { BenchComponent } from '../physics/types'
import { formatAngle, formatLength, formatNumber, toPerMm } from '../physics/units'
import { componentName } from './labels'

export interface ReportRow {
  label: string
  value: string
  /** Calculated (theoretical) result: hidden from the student in experiment mode. */
  theory?: boolean
}

export interface ReportSection {
  title: string
  rows: ReportRow[]
}

export function buildReport(solution: BenchSolution, components: readonly BenchComponent[]): ReportSection[] {
  const sections: ReportSection[] = []
  const { source, imaging, beam, diffraction, grating, airy, polarization, mirror } = solution

  const system: ReportRow[] = [{ label: 'Physical model', value: solution.model }]
  if (source?.kind === 'laser') {
    system.unshift({ label: 'Light source', value: 'He-Ne laser (coherent, monochromatic)' })
    system.push({ label: 'Wavelength λ', value: formatLength(solution.wavelength!, 'nm', 1) })
    if (beam) {
      system.push(
        { label: 'Beam waist radius w₀', value: formatLength(beam.waistRadius, 'mm', 3) },
        { label: 'Divergence (full angle)', value: `${formatNumber(2000 * beam.divergenceHalfAngle, 2)} mrad` },
        { label: 'Rayleigh range z_R', value: formatLength(beam.rayleighRange, 'cm', 1) },
      )
    }
  } else if (source?.kind === 'tungsten') {
    system.unshift({ label: 'Light source', value: 'Tungsten lamp (broadband, extended)' })
    system.push(
      { label: 'Spectrum', value: `black body, ${TUNGSTEN_TEMPERATURE} K` },
      { label: 'Intensity', value: `${Math.round(source.intensity * 100)}%` },
      { label: 'Source aperture', value: formatLength(source.sourceSize, 'mm', 1) },
    )
  } else {
    system.unshift({ label: 'Light source', value: 'none' })
  }
  sections.push({ title: 'Current system', rows: system })

  const sorted = [...components].sort((a, b) => a.x - b.x)
  if (sorted.length > 0) {
    const rows: ReportRow[] = []
    sorted.forEach((component, index) => {
      rows.push({ label: `${componentName(component)} position`, value: formatLength(component.x, 'cm', 1) })
      const next = sorted[index + 1]
      if (next) {
        rows.push({
          label: `  ${componentName(component)} → ${componentName(next)}`,
          value: formatLength(next.x - component.x, 'cm', 1),
        })
      }
    })
    sections.push({ title: 'Bench layout (rail readings)', rows })
  }

  if (imaging) {
    const rows: ReportRow[] = [{ label: 'Object height ho', value: formatLength(imaging.objectHeight, 'mm', 1) }]
    const sequence = imaging.sequence
    if (sequence) {
      const many = sequence.stages.length > 1
      sequence.stages.forEach((stage, index) => {
        const tag = many ? ` (lens ${index + 1})` : ''
        const lens = components.find((c) => c.kind === 'lens' && Math.abs(c.x - stage.lensX) < 1e-9)
        rows.push(
          { label: `Focal length f${tag}`, value: formatLength(stage.focalLength, 'cm', 1), theory: lens?.kind === 'lens' && lens.concealed },
          { label: `Object distance do${tag}`, value: formatLength(stage.objectDistance, 'cm', 2) },
          { label: `Image distance di${tag}`, value: formatLength(stage.imageDistance, 'cm', 2), theory: true },
        )
        if (many) rows.push({ label: `Magnification${tag}`, value: formatNumber(stage.magnification, 3), theory: true })
      })
      const m = sequence.magnification
      rows.push(
        { label: 'Magnification m = −di/do', value: formatNumber(m, 3), theory: true },
        {
          label: 'Image height hi',
          value: imaging.imageHeight === null ? '—' : formatLength(imaging.imageHeight, 'mm', 2),
          theory: true,
        },
        {
          label: 'Image',
          value: sequence.atInfinity
            ? 'at infinity (collimated)'
            : `${sequence.isReal ? 'Real' : 'Virtual'} / ${m < 0 ? 'Inverted' : 'Upright'} / ${
                Math.abs(Math.abs(m) - 1) < 1e-6 ? 'Same size' : Math.abs(m) > 1 ? 'Magnified' : 'Reduced'
              }`,
          theory: true,
        },
      )
    } else {
      rows.push({ label: 'Image', value: 'none — no lens after the object' })
    }
    if (imaging.screen) {
      rows.push(
        { label: `${imaging.element === 'mirror' ? 'Mirror' : 'Lens'} → screen distance`, value: formatLength(imaging.screen.distance, 'cm', 2) },
        { label: 'Picture scale on screen', value: formatNumber(imaging.screen.scale, 3), theory: true },
        { label: 'Blur circle diameter', value: formatLength(imaging.screen.blurDiameter, 'mm', 2), theory: true },
        { label: 'Focus', value: imaging.screen.inFocus ? 'sharp' : 'out of focus', theory: true },
        { label: 'Irradiance / radiance', value: `${imaging.screen.irradiancePerRadiance.toExponential(2)} sr`, theory: true },
      )
    }
    if (mirror) rows.splice(1, 0, { label: 'Radius of curvature R = 2f', value: formatLength(mirror.radius, 'cm', 1), theory: false })
    sections.push({ title: imaging.element === 'mirror' ? 'Image formation (spherical mirror)' : 'Image formation (thin lens)', rows })
  }

  if (polarization) {
    const rows: ReportRow[] = polarization.stages.map((stage, index) => ({
      label: `After polariser ${index + 1} (axis ${formatAngle(stage.angle, 0)})`,
      value: `${formatNumber(100 * stage.transmission, 1)}%`,
    }))
    // What a photodetector at the screen reads, relative to the unobstructed source.
    rows.push({ label: 'Relative irradiance at screen', value: `${formatNumber(100 * polarization.transmission, 1)}%` })
    sections.push({ title: 'Polarisation (detector reading)', rows })
  }

  if (beam && !diffraction && !grating && !airy) {
    const rows: ReportRow[] = []
    if (beam.radiusAtScreen !== null) {
      rows.push({ label: 'Spot diameter on screen (1/e²)', value: formatLength(2 * beam.radiusAtScreen, 'mm', 3), theory: true })
    }
    beam.path.waists.slice(1).forEach((waist, index) => {
      rows.push(
        { label: `Focused waist ${index + 1} position`, value: formatLength(waist.x, 'cm', 2), theory: true },
        { label: `Focused waist ${index + 1} radius`, value: formatLength(waist.radius, 'um', 1), theory: true },
      )
    })
    if (rows.length > 0) sections.push({ title: 'Gaussian beam', rows })
  }

  if (diffraction) {
    const d = diffraction
    const rows: ReportRow[] = [
      { label: d.polychromatic ? 'Reference wavelength' : 'Wavelength λ', value: formatLength(d.wavelength, 'nm', 1) },
      { label: 'Slit width a', value: formatLength(d.slitWidth, 'mm', 3) },
    ]
    if (d.separation !== null) rows.push({ label: 'Slit separation d', value: formatLength(d.separation, 'mm', 3) })
    rows.push({ label: 'Slit → screen distance L', value: formatLength(d.distance, 'cm', 1) })
    if (Math.abs(d.effectiveB - d.distance) > 1e-9) {
      rows.push({ label: 'Effective distance B (with lenses)', value: formatLength(d.effectiveB, 'cm', 2), theory: true })
    }
    rows.push(
      { label: 'Diffraction model', value: d.model === 'fraunhofer' ? 'Fraunhofer (far field)' : 'Fresnel (near field)' },
      { label: 'Fresnel number N_F', value: `${d.fresnelNumber < 0.01 ? d.fresnelNumber.toExponential(1) : formatNumber(d.fresnelNumber, 3)} — ${d.regime}` },
      { label: 'First minimum angle θ₁', value: d.firstMinimumAngle === null ? 'none (a < λ)' : formatAngle(d.firstMinimumAngle, 3), theory: true },
      { label: 'Central maximum width 2λL/a', value: formatLength(d.centralMaximumWidth, 'mm', 2), theory: true },
    )
    if (d.fringeSpacing !== null) {
      rows.push(
        { label: 'Fringe spacing Δy = λL/d', value: formatLength(d.fringeSpacing, 'mm', 3), theory: true },
        { label: 'Bright fringes in central maximum', value: String(d.fringesInCentralMaximum), theory: true },
      )
    }
    if (d.beamRadiusAtSlit !== null) rows.push({ label: 'Beam radius at slit', value: formatLength(d.beamRadiusAtSlit, 'mm', 3) })
    if (d.polychromatic) rows.push({ label: 'Smear from source size', value: formatLength(d.smearWidth, 'mm', 2), theory: true })
    sections.push({ title: d.kind === 'single' ? 'Single-slit diffraction' : 'Double-slit interference', rows })
  }
  if (grating) {
    const rows: ReportRow[] = [
      { label: grating.polychromatic ? 'Reference wavelength' : 'Wavelength λ', value: formatLength(grating.wavelength, 'nm', 1) },
      { label: 'Line density', value: `${formatNumber(toPerMm(grating.lineDensity), 0)} lines/mm` },
      { label: 'Grating period d', value: formatLength(grating.period, 'um', 3) },
    ]
    if (grating.distance !== null) rows.push({ label: 'Grating → screen distance L', value: formatLength(grating.distance, 'cm', 1) })
    rows.push({ label: 'Lines illuminated', value: formatNumber(grating.illuminatedLines, 0) })
    for (const entry of grating.orders) {
      if (entry.order === 0) continue
      rows.push(
        { label: `Order ${entry.order}: angle θ`, value: formatAngle(entry.angle, 2), theory: true },
        {
          label: `  order ${entry.order}: position y = L tan θ`,
          value: entry.position === null ? '—' : `${formatLength(entry.position, 'mm', 2)}${entry.onScreen ? '' : ' (off the screen)'}`,
          theory: true,
        },
        { label: `  order ${entry.order}: power relative to order 0`, value: `${formatNumber((100 * entry.efficiency) / grating.orders[0].efficiency, 1)}%`, theory: true },
      )
    }
    sections.push({ title: 'Diffraction grating (d sin θ = mλ)', rows })
  }

  if (airy) {
    const rows: ReportRow[] = [
      { label: 'Wavelength λ', value: formatLength(airy.wavelength, 'nm', 1) },
      { label: 'Aperture diameter D', value: formatLength(airy.diameter, 'mm', 3) },
      { label: 'Aperture → screen distance L', value: formatLength(airy.distance, 'cm', 1) },
    ]
    if (Math.abs(airy.effectiveB - airy.distance) > 1e-9) {
      rows.push({ label: 'Effective distance B (with lenses)', value: formatLength(airy.effectiveB, 'cm', 2), theory: true })
    }
    rows.push(
      { label: 'Fresnel number N_F', value: `${airy.fresnelNumber < 0.01 ? airy.fresnelNumber.toExponential(1) : formatNumber(airy.fresnelNumber, 3)} — ${airy.regime}` },
      { label: 'First dark ring angle θ₁', value: airy.firstZeroAngle === null ? 'none (D < 1.22λ)' : formatAngle(airy.firstZeroAngle, 3), theory: true },
      { label: 'First dark ring radius 1.22λL/D', value: formatLength(airy.firstDarkRingRadius, 'mm', 2), theory: true },
      { label: 'Beam radius at aperture', value: formatLength(airy.beamRadiusAtAperture, 'mm', 3) },
    )
    sections.push({ title: 'Circular aperture (Airy pattern)', rows })
  }
  return sections
}
