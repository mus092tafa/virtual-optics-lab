# Tasks

## 1. Physics

- [x] 1.1 Add the polarisation setting to the surface solver (Rs, Rp, Brewster angle, power for the chosen polarisation) with tests for normal incidence, Rp = 0 at tan⁻¹(n₂/n₁) and energy conservation; `npm test` passes
- [x] 1.2 Document the polarisation model in `docs/PHYSICS.md`

## 2. Laboratory

- [x] 2.1 Add the polarisation control and the Rs, Rp and θB read-outs to Section A, and stop drawing rays that carry no power; verify the reflected ray disappears at Brewster's angle
- [x] 2.2 Add the "Brewster's Angle" experiment (preset, guide, analysis, sweep) with a test that the ideal angle returns the index of the second medium

## 3. Validation

- [x] 3.1 Run the experiment in the app for air → crown glass and check the angle of minimum reflection against tan⁻¹(n₂/n₁)
