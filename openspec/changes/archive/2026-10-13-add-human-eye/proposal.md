# Proposal

## Why

The laboratory covers lenses on a rail but not the optical instrument every student carries: the eye. Accommodation, short and long sight, presbyopia and the way glasses correct them are all consequences of the vergence and thin-lens relations the lab already teaches, so they can be offered as experiments with checkable numbers instead of a textbook picture.

## What Changes

- **A schematic eye as a new apparatus.** A side view of the Gullstrand–Emsley eye: one corneal surface, the pupil, a lens with two surfaces, the retina. Each surface has the power P = (n′ − n)/r, the lens the thick-lens power P₁ + P₂ − (t/n) P₁P₂, and the whole eye is traced with paraxial ray-transfer matrices (reduced vergence L′ = L + P, L₂ = L₁/(1 − (d/n) L₁)).
- **Curvature is the input, power the result.** The student sets the corneal radius and the eye's axial length; the corneal, lens and total powers are calculated and shown.
- **Accommodation.** The lens surfaces steepen between the relaxed and the accommodated Gullstrand–Emsley lens. The eye accommodates by itself to put the image on the retina, as far as its amplitude allows; the student can also hold the lens at a chosen state.
- **Ageing.** The largest accommodation falls with age after Hofstetter's average, A = 18.5 − 0.30 × age dioptres. Only the lens's ability to change shape depends on age; the cornea and the axial length are separate controls.
- **Conditions.** Normal, myopia (eye too long, or cornea too strong), hyperopia (eye too short), presbyopia (an older normal eye). The refractive error K is the vergence of the eye's far point at the cornea.
- **Glasses.** A thin lens of power Fs at a vertex distance d in front of the cornea. The light reaching the cornea has vergence L′/(1 − d L′) with L′ = L + Fs; full correction of an error K needs Fs = K/(1 + dK).
- **The image the eye forms.** A test chart at the object distance is shown as it falls on the retina, blurred by a disc whose diameter is the height of the pupil-edge ray at the retina — pupil size times defocus, not an arbitrary effect.
- **Measurements**, with and without the glasses side by side: object distance, corneal, lens and total power, accommodation in use and needed, glasses power, position of the focus relative to the retina, blur-disc diameter, far point, near point, and a sharpness grade.
- **Three experiments** in a new topic "The Eye": accommodation and the near point; correcting myopia and hyperopia; ageing and reading glasses. Each has a guide, a notebook analysis and a demonstration sweep.
- **Comparison of two ages.** A second eye of another age looks at the same object through the same glasses, with both images shown.
- **Exam benches.** An eye set-up can be the bench of an exam question; with the unknowns concealed the student sees an "unknown eye" and must find its correction from the image.

Stated as limits, not modelled: astigmatism, spherical and chromatic aberration, diffraction at the pupil, the Stiles–Crawford effect, and everything the retina and brain do with the image.

## Capabilities

### New Capabilities
- `human-eye`: the schematic eye — its powers, accommodation and its limit with age, refractive errors, the retinal image and its blur, the eye experiments and the unknown eye of an exam.
- `spectacle-correction`: a spectacle lens in front of the eye — how it changes the vergence reaching the cornea, the power that corrects an error, and the before/after comparison.

### Modified Capabilities

## Impact

- `src/physics/`: new `eye.ts` (schematic eye, accommodation, age, blur) and `spectacles.ts`; surface-refraction matrices added to `rayTransfer.ts`; eye constants in `constants.ts`.
- `src/state/`: a fourth laboratory section `eye` with its state, presets and sweeps. Saved configurations and exam snapshots gain an `eye` block; older files load with the default eye.
- `src/education/`: three experiments, a sixth topic in `topics.ts` (this change builds on the topic navigation of the `organize-lab-navigation` branch).
- `src/render/`: the test charts and their blurred image. `src/components/eye/`: scene, workspace, controls.
- `docs/PHYSICS.md`, `README.md`, unit tests. No new dependencies.
