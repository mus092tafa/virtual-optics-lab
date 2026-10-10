# Design

## Context

Section A is built around one point of incidence on one surface. A prism has two refracting faces and a ray path inside the glass, so it needs its own solver and scene. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Exact (non-paraxial) two-face refraction for any wavelength.
- Indices from published Sellmeier coefficients, verified against catalogue values in the unit tests.

**Non-Goals:**
- Changing the fixed 589 nm indices of the existing reflection and refraction experiments.
- Multiple internal reflections, absorption, or beams of finite width.

## Decisions

- **Separate `prism.ts` and `PrismWorkspace`.** The prism state (apex angle, glass, incidence, light) lives beside the surface state and Section A switches scene by experiment. Alternative considered: a third `kind` in `SurfaceSetup`. Rejected because none of its fields (tilt, two media, one normal) describe a prism.
- **Sellmeier over Cauchy.** Three-term Sellmeier coefficients are published for each glass and reproduce catalogue indices to 10⁻⁵; a two-term Cauchy fit would need invented coefficients.
- **Deviation is an instrument reading.** In a real lab δ is read from a spectrometer table, so the lab shows it in every mode and the student searches for its minimum. The index n(λ) is the withheld quantity.
- **Geometry check on the second face.** The ray enters at a fixed fraction of the first face; the solver intersects the internal ray with the second face and reports a miss if it leaves through the base.
- **White light as discrete rays.** Seven wavelengths from 420 to 680 nm, each traced exactly and coloured by the existing CIE conversion.

## Risks / Trade-offs

- [Sellmeier coefficients typed from memory could be wrong] → unit tests pin n_d for every glass to the catalogue value.
