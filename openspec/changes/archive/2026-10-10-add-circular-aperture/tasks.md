# Tasks

## 1. Physics

- [x] 1.1 Add `airy.ts` (Bessel J₁, Airy intensity, first-zero angle) with tests against tabulated J₁ values, the zero at x = 3.8317 and the 1.75 % first ring; `npm test` passes
- [x] 1.2 Add the `pinhole` component and solver branch (Fresnel-number notices, lamp not modelled) with solver tests; `npm test` passes
- [x] 1.3 Document the model in `docs/PHYSICS.md`

## 2. Laboratory

- [x] 2.1 Add palette entry, glyph, controls, caption and report rows; verify the rings appear on the screen
- [x] 2.2 Add the "Circular Aperture" experiment (preset, guide, analysis, sweep) with a test that an ideal ring diameter returns the aperture diameter

## 3. Validation

- [x] 3.1 Run the experiment in the app and check the first dark ring radius against 1.22 λ L / D
