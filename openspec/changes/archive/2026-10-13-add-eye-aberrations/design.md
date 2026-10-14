# Design

## Context

`eye.ts` traces the Gullstrand–Emsley eye with 2 × 2 ray-transfer matrices for an object point on the axis and returns one `EyeView`: powers, accommodation, focus, a blur-disc diameter and three rays for the side view. `eyeImage.ts` draws the chart at its retinal size and convolves it with a uniform disc. `EyeScene` draws one vertical section. The state of the eye (`EyeSetting`) travels in saved configurations and exam snapshots; `concealed` hides the length, the cornea and the age. See proposal.md for motivation.

Three properties of that model are removed here, one at a time: one curvature per surface, one wavelength, small angles. The laboratory's rule is that everything on screen comes from the solver, so each of them needs a model, not an effect.

## Goals / Non-Goals

**Goals:**
- Each aberration follows from stated equations and is checked against an analytical result or a published value in unit tests.
- With every aberration off, the solver returns the numbers it returns today, bit for bit where the code path is unchanged.
- One description of "the light of one object point on the retina" that the image, the cross-sections and the sharpness grade all use.
- Each aberration can be used on an exam bench under the existing `examLock`, `theoryVisible()` and concealment rules.

**Non-Goals:**
- Real rays in an astigmatic eye. That needs skew rays through toric surfaces; it is refused on screen instead.
- Objects off the axis: coma, oblique astigmatism, field curvature, transverse chromatic aberration.
- Diffraction at the pupil and wavefront (Zernike) descriptions.
- Astigmatism of the lens, irregular astigmatism, the gradient index of the lens, the Stiles–Crawford effect.
- Chromatic aberration and thickness of the spectacle lens, prismatic effects, bifocal lenses.
- A free three-dimensional view.

## Decisions

- **Three independent switches, each off by default.** Astigmatism is a property of the cornea (a second radius, absent by default), chromatic aberration is a switch that lets the indices follow the wavelength (off: the 589 nm indices in every light, so white light gives the neutral image of today), spherical aberration follows from the choice of real rays. Alternative: one "realistic eye" mode. Rejected: a student could not attribute what they see to a cause, and the existing experiments would change.

- **Astigmatism: paraxial rays with 2 × 2 blocks.** A ray is (**y**, **u**) with two-component height and slope; a toric surface refracts with **u′** = (n/n′)**u** − ((n′ − n)/n′) **C** **y**, **C** = R(θ) diag(1/r₁, 1/r₂) R(θ)ᵀ; a thin sphero-cylinder with **u′** = **u** − **F** **y**; a gap with **y′** = **y** + d **u**. This is exact in the paraxial approximation for any orientation of cornea and glasses (obliquely crossed cylinders included). New module `astigmatism.ts`; `rayTransfer.ts` is untouched. Alternative: two independent 2 × 2 traces, one per principal meridian. Rejected: it is wrong as soon as the glasses' axis differs from the cornea's meridian, which is the mistake the experiment is about.

- **The beam of an object point is two 2 × 2 matrices.** With vergence L at the first element, a ray entering at **p** has **y** = **A** **p**, **u** = **B** **p** at any plane. The stop is the iris: a ray is named by its position **s** in the pupil, **p** = **A**ₛ⁻¹**s**. At a plane x behind the lens **y** = **W**(x) **s** with **W**(x) = (**A**_b + (x − x_b)**B**_b) **A**ₛ⁻¹. Focal lines are the roots of det **W**(x) = 0 (a quadratic); the blur at the retina is the image of the pupil circle under **W**, an ellipse whose semi-axes are the singular values of **W** times the pupil radius. The refractive error is the vergence matrix **K** with **W**(retina) = 0, solved as a 2 × 2 linear system; its eigenvalues and eigenvectors give sphere, cylinder and axis.

- **Angles are those of an examiner facing the eye** (TABO: counter-clockwise from the horizontal, 0° to 180°). The image panel shows what the eye sees, which is that picture mirrored left to right; the solver's ellipse is mirrored once, in the renderer, and the lines of the fan chart carry the label of their meridian in the examiner's frame, so a reading off the chart is directly an axis. Alternative: the subject's frame throughout. Rejected: prescriptions and the front view use the examiner's frame.

- **Automatic accommodation aims at the dioptric midpoint** of the two meridians, (K₁ + K₂)/2 − L, which puts the circle of least confusion on the retina. It is an assumption about a control loop, stated in `docs/PHYSICS.md`; the student can hold the lens.

- **Corneal radii stay the inputs.** `cornealRadius` keeps its meaning for the first meridian; `cornealRadiusCross` and `cornealMeridian` are added. The condition "astigmatism" is a preset whose second radius is solved from a wanted corneal astigmatism of 2 D, as the myopic length is solved from K.

- **Chromatic aberration: one dispersion curve for all media.** n(λ) − 1 = (n₅₈₉ − 1) · s(λ), s(λ) = (n_c(λ) − 1)/(n_c(589 nm) − 1), with n_c the index of the chromatic eye of Thibos, Ye, Zhang & Bradley (1992). The schematic eye's indices are taken to hold at 589 nm. The model then gives K(486) = −0.61 D and K(656) = +0.24 D, 5% less than the chromatic eye's own 0.90 D between those lines, because the separations of a three-surface eye do not scale with the powers. Alternatives: (a) add the published chromatic difference of refraction to the vergence as a number. Rejected: the focus inside the eye and the drawn rays would not follow from the indices. (b) Separate dispersion formulas for aqueous, lens and vitreous. Rejected: more constants than any experiment here can test, and the published sets are fitted to the same total.

- **White is a black body of 6500 K**, sampled in bands with the lab's existing colorimetry (`spectrum.ts`); each band carries its linear-sRGB weight and its own point-spread function. The eye accommodates for 589 nm in white light and for the wavelength itself in monochromatic light.

- **Spherical aberration: exact meridional ray tracing through conicoids**, new module `eyeRays.ts`. Surface: c(y² + (1 + Q)s²) − 2s = 0 with s the distance from the vertex plane; the intersection with a ray is the smaller root of a quadratic; refraction in vector form, **d′** = μ**d** + (μ cos i − √(1 − μ²(1 − cos² i)))**n**, μ = n/n′. The glasses stay an ideal thin lens (u′ = u − Fy). A ray is named by its height at the iris plane and found by bisection on its height at the first element. Alternative: third-order (Seidel) coefficients. Rejected: with an 8 mm pupil the fifth order is not small, and a real-ray trace has an exact check (the stigmatic ellipsoid).

- **Asphericity presets.** "Spherical surfaces": Q = 0 everywhere, the schematic eye as published. "Average eye": cornea Q = −0.26 (Kiely, Smith & Carney 1982) and one Q for both lens surfaces, solved so that a distant ray entering 3 mm from the axis has 1.0 D of longitudinal spherical aberration, the mean of measured eyes (Porter et al. 2001: Z₄⁰ = 0.138 µm over 5.7 mm). The solve gives Q ≈ −2.2; it stands in for the gradient index of the real lens, and the guide says so. Both Q are also sliders. Alternative: Navarro's conic constants (−3.13, −1.0). Rejected: they belong to a different eye (four surfaces, other indices) and leave twice the measured aberration on this one.

- **Accommodation ignores spherical aberration**: the eye still puts the paraxial focus on the retina. The best focus then lies elsewhere, which is what the experiment measures (the shift of the sharpest lens with the pupil).

- **The light of one object point is a list of components**, `PointSpread`: each has linear-sRGB weights and a shape, either an ellipse (two semi-axes, a direction) or a set of concentric annuli of equal energy. Paraxial light gives one ellipse per wavelength. Real rays give, per wavelength, the annuli between the retinal heights of rays at the boundaries of N equal-area zones of the pupil. The equivalent blur diameter is 2√2 times the luminance-weighted RMS radius: (a² + b²)/4 for an ellipse, the mean of ρ² for the annuli. For a disc of radius R this is 2R, so the sharpness grade of the symmetric eye is unchanged.

- **Rendering in two paths.** One ellipse, the same in all channels: a row-span convolution on prefix sums, the generalisation of the existing `discBlur` (which stays in use for a = b). Anything else: the components are rasterised into three kernels with exact area coverage per pixel, and the chart is convolved with them by a radix-2 FFT, on a zero-margined grid capped at 512 (two real kernels share one complex transform, so a coloured picture takes five transforms and a white one three; measured at about 25 ms each). Both conserve energy; a test checks the two paths against each other on a disc.

- **Chromatic difference of magnification is neglected** in the image: one chart size (that of 589 nm, or of the monochromatic wavelength) for all bands. With the stop 3.6 mm behind the cornea the difference between 450 and 650 nm is below 1% of the distance from the axis, under 3 µm in the largest field offered. Stated as a limit.

- **Views are sections with projected rays.** The side view draws the vertical section (corneal curvature **e**ᵧᵀ**C** **e**ᵧ) and the rays through the pupil's top and bottom; the top view the horizontal section and the rays through its left and right edge. With oblique meridians those rays leave the plane; the views draw their projections and say so. The beam cross-sections are exact for any orientation: **W**(x) applied to the pupil circle, or the annuli of the real rays, at seven planes spanning the foci, the retina among them. The front view draws the pupil at its diameter, the principal meridians with their radii and the cylinder axis on a 0–180° scale. Alternative: a rotatable 3-D scene. Rejected: nothing could be measured in it.

- **Solver interface.** `EyeSetup` gains `cornealRadiusCross`, `cornealMeridian`, `wavelength` (null for white), `realRays`, `cornealAsphericity`, `lensAsphericity`; `Glasses` gains `cylinder` and `axis`. `EyeView` keeps every existing field (`blurDiameter` becomes the equivalent blur diameter) and gains `refraction`, `focalLines`, `blur` (two diameters and a direction), `pointSpread`, `raysTop`, `sections`, `sphericalAberration`, and notices for refused configurations. One paraxial path serves every eye: with the additions at their neutral values the block matrices are multiples of the unit matrix and the arithmetic is that of the scalar solver, which the existing tests of the symmetric eye pin.

- **Spherical aberration is measured zone by zone, with a ring stop.** `pupilZone` covers the middle of the pupil up to a fraction of its radius; real rays are traced through the open ring only, named by its root-mean-square radius h. Alternative, first built: the notebook compared the glasses found sharpest with a 2 mm and with an 8 mm open pupil with the model's shift. Rejected after validation in the app: with a wide open pupil the lens that is "sharpest" depends on the criterion (−1.0 D by the contrast of the picture, −1.6 D by the smallest RMS blur, −0.5 D by the contrast of bars one stroke wide, for the same eye), so there is no value to compare a student's choice with. A narrow ring has one focus: through 2.70–3.00 mm the sharpest picture is at −1.25 D where the model's zone needs −1.15 D.

- **Concealment and exam mode.** `concealed` additionally hides the second radius, the meridian and both asphericities; controls for them are disabled as the existing ones are. Every new calculated value is shown only under `theoryVisible()`. The light on the chart and the ray switch are settings of the bench, saved in the snapshot and fixed for the student by the same lock as the rest of the eye.

**Assumptions and range of validity.** Astigmatism: paraxial; a toric cornea and a thin sphero-cylindrical lens, centred; radii 7.0–8.6 mm in both meridians (up to 9 D of corneal astigmatism). Chromatic: 400–700 nm; homogeneous media sharing one dispersion curve; the result is within 0.1 D of the measured chromatic difference of refraction over that range. Spherical: surfaces that are conicoids of revolution with −6 ≤ Q ≤ 1, homogeneous media, object on the axis, pupil 2–8 mm; rays that miss a surface or are totally reflected are counted as blocked and reported. The lens asphericity is held fixed while the eye accommodates. Geometric optics throughout: within about 5 µm of a point the picture is finer than diffraction allows (Airy radius 1.22 λ f/D ≈ 3.7 µm at 4 mm), and "sharp" still means "in geometric focus".

## Risks / Trade-offs

- [Constants of the chromatic eye and the population values typed from memory could be wrong] → tests pin n_c(589 nm) = 1.3330 and the model's 0.85 D between 486 and 656 nm, and check it lies within 10% of the published 0.9–1.0 D; `docs/PHYSICS.md` names the sources.
- [The fitted lens asphericity presents a homogeneous lens as an "average eye"] → labelled as a fit to the measured total, with the limit stated; the spherical-surface preset is the default.
- [The FFT path is slower than the disc path and runs for up to three images] → the grid is capped at 512; measured in the app, a white-light picture repaints in about 0.2 s against 0.07 s for a disc, which a slider drag shows as a visible lag.
- [Wrap-around of the FFT brings light across the picture's edge] → zero padding by the kernel's reach, as the disc path already pads.
- [Mirror between the examiner's and the subject's frame is easy to get wrong] → one place applies it; a test puts a focal line on the retina and checks which labelled line of the fan stays sharp.
- [`blurDiameter` changes meaning for non-disc blurs] → equal to the old value for a disc by construction; a test pins the existing cases.
- [Projected rays in oblique views can be mistaken for rays in the plane] → the note on the view, and the cross-sections as the exact picture.

## Migration Plan

Saved configurations and exam files without the new fields load with their neutral values (equal radii, 589 nm, paraxial rays, Q = 0, no cylinder), through the existing merge with the default eye. No stored data changes.
