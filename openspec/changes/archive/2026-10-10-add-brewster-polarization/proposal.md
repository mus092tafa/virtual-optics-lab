# Proposal

## Why

Section A already computes the Fresnel reflectances Rs and Rp but only uses their average. Letting the student choose the polarisation of the ray makes Brewster's angle observable and gives a second way to measure a refractive index.

## What Changes

- The ray source in Section A has a polarisation setting: unpolarised, s (perpendicular to the plane of incidence) or p (in the plane of incidence).
- Reflected and transmitted power, and the brightness of the drawn rays, follow the Fresnel coefficient for the chosen polarisation. A ray that carries no power is not drawn.
- The physics read-out shows Rs, Rp and Brewster's angle.
- New experiment "Brewster's Angle": find the angle at which the reflected p-polarised ray vanishes and compute n₂ = n₁ tan θB.

## Capabilities

### New Capabilities
- `surface-polarization`: polarisation dependence of reflection at an interface, and the Brewster-angle experiment.

### Modified Capabilities

## Impact

- `src/physics/surface.ts`, `src/state/`, `src/education/experiments.ts`, `src/components/surface/`, `docs/PHYSICS.md`, tests.
