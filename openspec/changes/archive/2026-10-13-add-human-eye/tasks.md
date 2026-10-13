# Tasks

## 1. Eye model

- [x] 1.1 Add the refraction matrix of a spherical surface to `rayTransfer.ts`, with tests against (n′ − n)/r and the single-surface imaging equation n′/l′ − n/l = P; `npm test` passes
- [x] 1.2 Add the schematic-eye constants to `constants.ts` and `eye.ts` (surface powers, lens and total power, focus position, refractive error K, far point), with tests pinning 42.74 D, 21.75 D, 60.48 D and the 23.90 mm focal point
- [x] 1.3 Add accommodation to `eye.ts` (lens state a, accommodation in dioptres at the cornea, the a for a wanted accommodation, automatic accommodation with its limits), with tests for 8.6 D at a = 1 and for the in-reach, out-of-reach and held cases of the spec
- [x] 1.4 Add the age relation A = 18.5 − 0.30 × age and the near point, with tests for ages 20, 45, 55 and for an age above 62
- [x] 1.5 Add the axial length for a wanted K and the condition presets, with tests for ±3 D (25.04 mm, 22.85 mm) and the −3 D corneal case (7.29 mm)
- [x] 1.6 Add the blur-disc diameter and retinal image scale, with tests for 295 µm (25 cm, no accommodation, 4 mm pupil), zero in focus, and proportionality to the pupil
- [x] 1.7 Document the eye model in `docs/PHYSICS.md`: equations, constants and their source, assumptions, range of validity and limits

## 2. Glasses

- [x] 2.1 Add `spectacles.ts` (vergence through the lens and across the vertex distance, correcting power, K from a power found) and compose the lens into the eye trace, with tests for the −3, +3 and −6 D cases and the +1.50 D reading lens of the spec
- [x] 2.2 Add the with/without-glasses result to the eye solver, with a test that the correcting lens brings the blur of a −3 D eye to zero
- [x] 2.3 Document spectacle correction in `docs/PHYSICS.md`

## 3. Apparatus

- [x] 3.1 Add the `eye` section to the lab state (state block, defaults, clamped update action, presets, `mergeConfiguration`, `concealed` handling in `loadSnapshot`, unknown-eye action blocked under `examLock`), with a test that an older saved configuration loads with the default eye
- [x] 3.2 Add the test charts (letter chart, text line, schematic face) and their blurred retinal image to `src/render/`, with a test that a zero blur returns the chart unchanged and that the blur conserves energy
- [x] 3.3 Build `EyeScene` (cornea, lens, pupil, retina, glasses and rays from the solver; anatomy labels; object distance scale) and verify by a test that the drawn rays cross at the computed focus
- [x] 3.4 Build `EyeWorkspace` with the controls (object distance and size, chart, pupil, axial length, corneal radius, condition, age, accommodation hold, glasses and vertex distance), the image panel and the measurements with the before/after columns; every calculated value respects `theoryVisible()` and concealment
- [x] 3.5 Wire the section into `LabWorkspace`, the header, the report and the exam editor's bench summary; `npm run build` and `npm run build:student` pass

## 4. Experiments

- [x] 4.1 Add the topic "The Eye" to `topics.ts` and the three experiments (presets, guides with assumptions and limits, notebook fields and analysis, sweeps), with tests that ideal readings return the model's amplitude and K
- [x] 4.2 Add the comparison age (state, second solve, second image and measurement column), with a test for the 20 / 60 years case at 40 cm and at distance
- [x] 4.3 Describe the eye and its experiments in `README.md`, and the unknown eye in `docs/EXAMS.md`

## 5. Validation

- [x] 5.1 Run the three eye experiments in the app in learning mode and check the displayed powers, near points, focus positions, correcting powers and blur diameters against values calculated by hand from the equations in `docs/PHYSICS.md`
- [x] 5.2 In experiment mode, find the near point of a 45-year-old eye and the correction of the ±3 D eyes from the image alone, and compare with the revealed values
- [x] 5.3 Put an eye on an exam question with the unknowns concealed, sit it in the student edition and confirm nothing calculated or concealed is shown; open one experiment of every other topic to confirm the new section did not disturb them
- [x] 5.4 `npm test`, `npm run lint`, `npm run build` and `npm run build:student` pass
