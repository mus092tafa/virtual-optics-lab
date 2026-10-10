# Tasks

## 1. Physics

- [x] 1.1 Add `grating.ts` (order angles, efficiencies, laser order spots, lamp spectrum pattern) with unit tests against d sin θ = mλ and sinc² efficiencies; `npm test` passes
- [x] 1.2 Add the `grating` component type and solver branch in `optics.ts`, including the not-modelled cases, with solver tests; `npm test` passes
- [x] 1.3 Document the model, assumptions and limits in `docs/PHYSICS.md`

## 2. Laboratory

- [x] 2.1 Render the `spots` screen light and its intensity profile; verify the order spots appear at the calculated positions in the app
- [x] 2.2 Add palette entry, glyph, controls, caption and report rows for the grating; verify it can be mounted and adjusted
- [x] 2.3 Add the "Diffraction Grating" experiment (preset, guide, notebook analysis, sweep) with a test that ideal measurements return the laser wavelength

## 3. Validation

- [x] 3.1 Run the experiment in the app and check the order positions on the screen against y = L tan(sin⁻¹(mλ/d))
