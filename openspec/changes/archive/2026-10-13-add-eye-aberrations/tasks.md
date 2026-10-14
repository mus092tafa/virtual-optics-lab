# Tasks

## 1. Astigmatism

- [x] 1.1 Add `astigmatism.ts`: 2 × 2-block ray transfer (gap, toric surface, thin sphero-cylinder), the curvature and power matrices, and sphere / cylinder / axis from a symmetric matrix and back; tests against the scalar matrices of `rayTransfer.ts` for a symmetric surface and against the round trip of a prescription
- [x] 1.2 Extend `spectacles.ts` with cylinder and axis and the matrix form of the correcting lens; tests for 0.00 / −2.00 × 180 → 0.00 / −2.05 × 180 at 12 mm and for the unchanged spherical cases
- [x] 1.3 Extend the eye solver with the second corneal radius and its meridian: refraction as sphere / cylinder × axis, focal lines, blur ellipse, accommodation to the dioptric midpoint, rays of the top view; tests for the with-the-rule eye (line of 150 µm on the retina, second line 0.71 mm in front, circle of 75 µm at 1 m, zero blur with the correcting lens, 26 µm with the axis 10° off) and a test that equal radii return the existing results exactly
- [x] 1.4 Add the point-spread description and the equivalent blur diameter to the solver and grade the sharpness from it; tests that a disc returns its diameter and a 150 µm line 106 µm
- [x] 1.5 Add the ellipse convolution and the fan chart to `eyeImage.ts`, with the mirror to the subject's view; tests that a circle reproduces `discBlur`, that energy is conserved, and that a vertical focal line leaves the line labelled 90 sharp
- [x] 1.6 Add the state (second radius, meridian, cylinder, axis, the astigmatism condition solved from 2 D), clamping, concealment and loading of older files; test that a configuration without the fields loads as a symmetric eye
- [x] 1.7 Document astigmatism and sphero-cylindrical lenses in `docs/PHYSICS.md`: equations, the angle convention, assumptions and limits

## 2. Views

- [x] 2.1 Generalise `EyeScene` to draw either section from the solver (corneal curvature of the section, its rays, the projection note) and add the top view and the view switch; test that the rays of each view cross at the focal line of its meridian
- [x] 2.2 Add the front view (pupil, meridians with radii, cylinder axis, degree scale) with the meridians hidden for an unknown eye; verify in the app against the controls
- [x] 2.3 Add the beam cross-sections to the solver and a strip that draws them at one scale; test that the section at the retina equals the blur ellipse and that the sections at the focal lines are lines
- [x] 2.4 Add the controls for the cornea's second meridian and the glasses' cylinder and axis, and the new rows of measurements with their with/without-glasses columns, all under `theoryVisible()` and concealment; `npm run build` and `npm run build:student` pass

## 3. Chromatic aberration

- [x] 3.1 Add `ocularDispersion.ts` (the chromatic-eye index, the scaling of each medium) and make the eye solver take a wavelength; tests for n(589 nm) = 1.3330, K(486) = −0.61 D, K(656) = +0.24 D, their difference within 10% of 0.9 D, and unchanged results at 589 nm
- [x] 3.2 Add white light (6500 K bands with their sRGB weights), one point-spread component per band, luminance weighting of the equivalent blur diameter, and the chromatic difference of refraction to the solver; test the 70 µm patch at 450 nm for a 4 mm pupil and that the weights of the bands sum to the white of the lamp
- [x] 3.3 Add the kernel rasteriser and the FFT convolution to the renderer and use them when the point spread has more than one component; tests that the FFT path agrees with `discBlur` on a disc, conserves energy, and gives a grey image for a spectrum focused at every wavelength
- [x] 3.4 Add the light control (white or a wavelength) to the state and the controls, the colour of monochromatic images, and the measurements; verify in the app that blue needs a more negative lens than red
- [x] 3.5 Document the chromatic model in `docs/PHYSICS.md`: the formula and its source, the single-curve assumption, the 5% deviation, the neglected difference of magnification

## 4. Spherical aberration

- [x] 4.1 Add `eyeRays.ts`: conicoid surfaces, exact intersection and refraction, the ray through a given pupil height, blocked rays; tests against the closed form for a sphere (29.86 mm at 3 mm), the stigmatic ellipsoid (31.20 mm at every height) and the paraxial focus for a small height
- [x] 4.2 Add zone refraction, longitudinal spherical aberration, the annular point spread from equal-area zones, the ring stop that selects one zone, and the lens asphericity solved for 1.0 D at 3 mm; tests for 2.1 D and −0.73 mm at a 4 mm pupil with spheres, 0.40 mm equivalent blur at 6 mm, the fitted Q reproducing 1.0 D, and a ring brought to a sharp focus by the lens of its zone
- [x] 4.3 Wire real rays into the eye solver: the ray fan of the side view, the cross-sections from the annuli, the refusal with a notice for an astigmatic eye or cylinder glasses; test that a 0.1 mm pupil with real rays agrees with the paraxial focus and blur
- [x] 4.4 Add the state and controls (real rays, ring stop, corneal and lens asphericity, the two shape presets) with concealment, and the measurements; verify in the app that a narrow ring is sharpest with the lens of its zone
- [x] 4.5 Document the real-ray model in `docs/PHYSICS.md`: surface equation, Snell's law in vector form, the presets and their sources, assumptions and limits

## 5. Experiments

- [x] 5.1 Add the experiments "Astigmatism and the cylinder lens", "Chromatic aberration of the eye" and "Spherical aberration and the pupil" to the topic: presets, guides with assumptions and limits, notebook fields and analyses, sweeps; tests that ideal readings return the model's refraction, chromatic difference and zone aberration, and its growth with the square of the radius
- [x] 5.2 Update the limits in the guides of the three existing eye experiments, the README's section on the eye and `docs/EXAMS.md` for the newly concealed values; the experiment tests pass

## 6. Validation

- [x] 6.1 Run the astigmatism experiment in the app in learning mode and check the refraction, the focal lines, the blur diameters and the correcting lens against values calculated by hand from the equations in `docs/PHYSICS.md`; check all four views against each other for a horizontal, a vertical and an oblique meridian
- [x] 6.2 Run the chromatic experiment: read K at 486, 589 and 656 nm and compare with the formula; in experiment mode find the sharpest lens in blue and in red and compare the difference with the revealed value
- [x] 6.3 Run the spherical aberration experiment: compare the marginal crossing and the aberration in dioptres with an independent trace, and in experiment mode find the sharpest lens through a narrow ring from the image alone and compare the zone aberration with the revealed value
- [x] 6.4 Run the three existing eye experiments and confirm their numbers are unchanged; open one experiment of every other topic; load an astigmatic unknown eye as the locked bench of an exam question and confirm that nothing concealed or calculated is shown or can be revealed
- [x] 6.5 `npm test`, `npm run lint`, `npm run build` and `npm run build:student` pass

## Workflow follow-up

- Archive the change once the validation of group 6 is done and reported.
