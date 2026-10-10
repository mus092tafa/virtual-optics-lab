# Tasks

## 1. Physics

- [x] 1.1 Add `polarization.ts` (transmission of a sequence of ideal polarisers) with tests for ½, cos²θ, crossed and three-polariser cases; `npm test` passes
- [x] 1.2 Add the `polarizer` component and apply the transmitted fraction in the solver, with tests that only brightness changes; `npm test` passes
- [x] 1.3 Document the model in `docs/PHYSICS.md`

## 2. Laboratory

- [x] 2.1 Add palette entry, glyph, angle control, caption and the relative-irradiance read-out; verify the screen dims as the analyser turns
- [x] 2.2 Add the "Malus's Law" experiment (preset, guide, analysis, sweep) with a test that ideal readings give I/I₀ = cos²θ

## 3. Validation

- [x] 3.1 Run the experiment in the app and check the reading at several analyser angles against ½ cos²θ
