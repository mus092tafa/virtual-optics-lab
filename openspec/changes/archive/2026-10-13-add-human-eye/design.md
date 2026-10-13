# Design

## Context

The laboratory has three kinds of apparatus (`LabSection`: surface, bench, interferometer), each with its own state block, workspace and solver, and `LabWorkspace` picks one from the state. The rail of the bench is 150 cm long with thin lenses in air; the eye is 24 mm long, has refracting surfaces between media of different index, and its controls (age, accommodation, glasses) have no counterpart on the rail. See proposal.md for motivation.

`rayTransfer.ts` traces thin lenses in air with rays (y, u). The screen renderer already convolves a shape with a uniform disc for defocus. `exportSnapshot()` saves the whole lab state, so an eye set-up travels in configuration files and exam questions without extra work, and `loadSnapshot()` is where unknowns are concealed.

## Goals / Non-Goals

**Goals:**
- Numbers that agree with the published Gullstrand–Emsley eye and with the vergence formulas of ophthalmic optics, checked in unit tests.
- One model behind everything on screen: powers, rays, focus position, blur, sharpness.
- The eye usable on an exam bench from the start, under the existing `examLock` and `theoryVisible()` rules.

**Non-Goals:**
- Astigmatism and cylinder lenses, bifocal or progressive lenses, contact lenses as a separate type (a contact lens is the vertex distance set to zero).
- Aberrations, diffraction at the pupil, the Stiles–Crawford effect, depth of focus beyond the geometric blur, pupil constriction with accommodation or age.
- Any model of the retina or of perception. "The image the eye forms" is the light distribution on the retina.

## Decisions

- **A fourth section `eye` with its own state block, `eye.ts` solver and `EyeWorkspace`.** Alternative considered: components on the rail. Rejected: the rail solver assumes thin lenses in air and metre scales, and none of the eye's controls are rail components.

- **Gullstrand–Emsley three-surface eye.** Cornea r = 7.8 mm; aqueous and vitreous n = 4/3; lens n = 1.416. Relaxed: chamber 3.6 mm, lens radii +10 and −6 mm, thickness 3.6 mm. Accommodated: chamber 3.2 mm, radii +5 and −5 mm, thickness 4.0 mm. It gives 60.48 D and a second focal point 23.90 mm behind the cornea, which is taken as the normal axial length. Alternatives: the reduced eye (one surface) cannot show the lens changing shape or separate the cornea from the lens, which the brief asks for; Gullstrand's exact eye (six surfaces, a lens core) adds detail no experiment here measures.

- **Accommodation is one parameter a.** Surface curvatures, thickness and chamber depth are interpolated linearly in a between the relaxed (a = 0) and accommodated (a = 1, 8.6 D) eyes, and extrapolated beyond a = 1 for young eyes (14 D at age 15 needs a ≈ 1.59, front radius 3.9 mm). The state of the lens for a wanted accommodation is found by bisection on a; nothing is tabulated. Alternative: changing only the lens power as a number. Rejected: the lens shape on screen would then be drawn, not computed.

- **Accommodation in dioptres is defined at the cornea**, as the change of the object vergence the eye focuses, relative to a = 0. This is the quantity Hofstetter's formula and a near-point measurement refer to, so age, near point and notebook use one definition. With glasses the vergence is the one arriving at the cornea.

- **Automatic accommodation with a manual hold.** The solver takes the a that puts the image on the retina, clamped to [0, a_max(age)]. A switch holds a at a slider value instead. Alternative: manual only. Rejected: presbyopia is the failure of an automatic response, and a student who must find focus by hand for every distance cannot see that.

- **Refractive error from the axial length first.** Conditions are presets of (axial length, corneal radius, age): myopia 25.04 mm, hyperopia 22.85 mm (±3 D), presbyopia the normal eye at age 55. The corneal radius is a second, independent slider. The preset lengths are not stored numbers: they are solved from the wanted K.

- **Glasses are a thin lens in air at a vertex distance** (default 12 mm, 0–16 mm), composed into the same matrix as the eye, so the spectacle magnification of the retinal image comes out of the trace and is not a separate formula. "Type" follows from the sign of the power; reading glasses are a positive lens and are explained in the guide.

- **Surface matrices in the existing (y, u) convention.** `rayTransfer.ts` gains a refraction matrix for a spherical surface, [1, 0; −(n′ − n)/(n′ r), n/n′]. Alternative: a separate reduced-angle engine in `eye.ts`. Rejected: two conventions in one physics layer.

- **Blur and brightness.** The aperture stop is the iris at the front lens vertex; the pupil diameter set by the student (2–8 mm) is the real pupil. The blur diameter is 2·|y_retina| of the stop-edge ray from the axial object point. The chart is rendered at its retinal scale and convolved with that disc through the renderer's existing disc convolution; retinal illuminance scales with the pupil area. The image is shown the way it is seen (upright), with the measurements stating that it is inverted on the retina.

- **Test charts are generated, not image files.** A tumbling-E letter chart with stroke width one fifth of the letter height, a line of text, and a schematic face, each with a physical size at the object distance. The sharpness grade compares the blur diameter with the stroke width on the retina: ≤ ¼ sharp, ≤ 1 slightly blurred, ≤ 3 blurred, above unreadable. It is a geometric criterion and is labelled so; it is not a visual-acuity prediction.

- **The scene is to scale for the eye and schematic for the object distance.** From the glasses to behind the retina everything is drawn to one scale; rays carry their computed heights and are bent where they meet the drawn surfaces. The object, which may be metres away, is set on a separate labelled distance scale and is not drawn in the scene's scale. Ciliary muscle and zonule are drawn as labelled anatomy that follows a; they carry no calculation.

- **Unknown eye.** `concealUnknowns` on an exam snapshot, and a "Use an unknown eye" button in experiment mode (hidden under `examLock`), set `concealed` on the eye: axial length, corneal radius and age are then neither shown nor editable, as for a concealed lens.

- **Comparison is a second age, not a second eye state.** The state holds an optional comparison age; the solver runs twice on otherwise identical input.

**Assumptions and range of validity.** Paraxial optics with spherical, centred surfaces and homogeneous media; valid for the on-axis image and for pupil diameters where the real eye's aberrations are small against the defocus shown (the blur is trustworthy from about 0.25 D of defocus upward, not for the last fraction of a dioptre). Monochromatic at the indices given. Object distances from 5 cm to infinity; axial length 21–27 mm; corneal radius 7.0–8.6 mm; ages 15–75. The age relation is an average with a spread of several dioptres between people, and it reaches zero at 62 years although real eyes keep about 1 D of apparent accommodation from depth of focus. Outside these ranges the controls stop; the solver reports when no real image is formed in the eye.

## Risks / Trade-offs

- [Schematic-eye constants typed from memory could be wrong] → tests pin the total power (60.48 D), the focal length and the accommodated amplitude (8.6 D) to the published values.
- [Extrapolating the lens beyond the accommodated state is not a measured young lens] → stated in `docs/PHYSICS.md` and in the guide; the amplitude, which is what students measure, is exact by construction.
- [Rays bent at drawn surfaces while the model refracts at vertex planes] → the difference is second order in ray height; the focus position and blur shown are the model's, and a test checks the drawn rays meet at the computed focus.
- [Students read the sharpness grade as visual acuity] → labelled as a geometric measure, with the limits in the guide.
- [A fourth section touches every place that switches on `LabSection`] → the type is a union, so the compiler lists them.
- [Depends on `topics.ts` from the unmerged `organize-lab-navigation` branch] → merge that branch first.

## Migration Plan

Saved configurations and exam files without an `eye` block load with the default eye, as `mergeConfiguration` already does for the prism and the interferometer. No stored data changes.
