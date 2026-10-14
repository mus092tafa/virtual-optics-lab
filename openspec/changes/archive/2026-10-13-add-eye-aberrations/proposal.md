# Proposal

## Why

The eye of the laboratory is perfect apart from defocus: rotationally symmetric, at one wavelength, traced paraxially. The three defects every real eye has, and that opticians and optical engineers measure, are therefore missing: astigmatism, chromatic aberration and spherical aberration. Each follows from equations the lab can state and check, and the first of them cannot be seen in one side view, which is why the eye also needs more than one view.

## What Changes

- **Astigmatism of the cornea.** The cornea gets a second radius, in the meridian at right angles to the first, and the orientation of the pair. Each meridian has the power (n′ − 1)/r, so the eye has two focal lines instead of a focus (the conoid of Sturm). The eye is traced with paraxial ray-transfer matrices whose elements are 2 × 2 matrices: a toric surface refracts with the curvature matrix **C** = R(θ) diag(1/r₁, 1/r₂) R(θ)ᵀ. The refractive error becomes a sphere, a cylinder and an axis.
- **Cylinder glasses.** The glasses get a cylinder and an axis beside the sphere: the power matrix **F** = S·**1** + C·[sin²a, −sin a cos a; −sin a cos a, cos²a], thin, at the vertex distance. The correcting lens follows from **F** = **K**(**1** + d**K**)⁻¹, the matrix form of Fs = K/(1 + dK).
- **Elliptical blur.** The light of one object point falls on the retina in the ellipse that the circular pupil maps to; its two diameters follow from the two meridians. The chart is convolved with that ellipse.
- **Chromatic aberration.** The refractivity n − 1 of every medium of the eye changes with wavelength as in the chromatic eye of Thibos et al. (1992), n(λ) = 1.320535 + 0.004685/(λ − 0.214102 µm). Blue light is then focused in front of red: 0.85 D between 486 and 656 nm. The chart can be lit with white light or with one wavelength; in white light the image is the sum over the spectrum, each wavelength with its own blur.
- **Spherical aberration.** The surfaces become conicoids, z = c y²/(1 + √(1 − (1 + Q)c²y²)), and the light is traced exactly with Snell's law, n sin i = n′ sin i′, at every surface instead of paraxially. Rays through the edge of the pupil then cross the axis in front of the paraxial focus. The asphericity Q of the cornea and of the lens are the inputs; Q = 0 is the schematic eye with spherical surfaces.
- **More views of the eye.** A top view (horizontal section) beside the side view (vertical section), a front view with the pupil, the corneal meridians and the axis of the glasses on a protractor, and the cross-sections of the beam at planes before, at and behind the retina. All are drawn from the solver's rays.
- **A fan chart** (radial lines labelled with their meridian) for finding the axis of an astigmatic eye.
- **Three experiments** in the topic "The Eye": astigmatism and the cylinder lens; the chromatic aberration of the eye; spherical aberration and the pupil. Each with guide, notebook analysis and demonstration sweep.
- **Measurements**: the refraction as sphere / cylinder × axis, the two focal lines and the interval between them, the blur as two diameters, the chromatic difference of refraction, the zone refraction of the marginal ray.
- With a symmetric cornea, monochromatic light of 589 nm and paraxial tracing, the eye is exactly the eye of today: every number of the existing specifications stays.

Stated as limits, not modelled: irregular astigmatism and astigmatism of the lens, spherical aberration together with astigmatism (real rays are traced only in a symmetric eye), off-axis aberrations (coma, oblique astigmatism), the chromatic aberration of the spectacle lens, diffraction at the pupil, the gradient index of the lens, and the Stiles–Crawford effect.

## Capabilities

### New Capabilities
- `eye-astigmatism`: a toric cornea — its two meridians, the focal lines, the sphero-cylindrical refraction, the elliptical blur and the astigmatism experiment.
- `eye-chromatic-aberration`: the dependence of the eye's focus on wavelength, monochromatic and white light on the chart, the coloured image and the chromatic experiment.
- `eye-spherical-aberration`: aspheric surfaces traced with real rays, the zone refraction, the image with spherical aberration and the experiment on the pupil.
- `eye-views`: the views of the eye beside the side view — top, front and beam cross-sections.

### Modified Capabilities
- `human-eye`: the list of what the eye experiments state as not modelled changes, and the measurements reported gain the new quantities.
- `spectacle-correction`: glasses gain a cylinder and an axis, and the correcting lens is given in sphere / cylinder × axis.

## Impact

- `src/physics/`: `astigmatism.ts` (2 × 2-block ray transfer, sphero-cylinder arithmetic), `ocularDispersion.ts`, `eyeRays.ts` (conic surfaces, exact tracing); `eye.ts` and `spectacles.ts` extended; constants in `constants.ts`.
- `src/render/eyeImage.ts`: blur with an ellipse, and with a general point-spread function by Fourier transform; a fan chart.
- `src/components/eye/`: top view, front view, beam cross-sections, new controls. `src/state/`: new fields of the eye, presets, sweeps; saved configurations and exam files without them load as a symmetric, monochromatic, paraxial eye.
- `src/education/`: three experiments and their analyses. `docs/PHYSICS.md`, `README.md`, `docs/EXAMS.md`, unit tests. No new dependencies.
