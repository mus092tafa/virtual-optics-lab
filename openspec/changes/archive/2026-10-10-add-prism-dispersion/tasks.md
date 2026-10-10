# Tasks

## 1. Physics

- [x] 1.1 Add `dispersion.ts` (Sellmeier indices for BK7, F2, SF10, fused silica) with tests pinning n_d to catalogue values and checking normal dispersion; `npm test` passes
- [x] 1.2 Add `prism.ts` (two-face refraction, deviation, minimum deviation, TIR and missed-face cases, Fresnel transmission) with tests against the minimum-deviation formula; `npm test` passes
- [x] 1.3 Document both models in `docs/PHYSICS.md`

## 2. Laboratory

- [x] 2.1 Add the prism state, scene and workspace to Section A; verify the ray path, the white-light fan and the deviation read-out
- [x] 2.2 Add the "Prism — Minimum Deviation" experiment (preset, guide, analysis, sweep) with a test that the ideal δmin returns n(λ)

## 3. Validation

- [x] 3.1 Run the experiment in the app: find the minimum deviation for BK7 at 632.8 nm and check n against the Sellmeier value
