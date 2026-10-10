# Proposal

## Why

Refractive indices in the lab are fixed at 589 nm, so dispersion, the reason a prism makes a spectrum, cannot be observed or measured. The minimum-deviation method is also the standard precise way to measure a refractive index.

## What Changes

- Wavelength-dependent refractive indices n(λ) from Sellmeier equations for four optical glasses (BK7, F2, SF10, fused silica).
- New Section A scene: a ray refracted through a triangular prism with adjustable apex angle, glass and angle of incidence, for any He-Ne line or for white light drawn as a fan of coloured rays.
- The deviation δ is shown as an instrument reading; it passes through a minimum as the prism is rotated.
- Total internal reflection at the second face and a ray that misses the second face are reported, not drawn as emerging light.
- New experiment "Prism — Minimum Deviation": n = sin((A + δmin)/2) / sin(A/2).

## Capabilities

### New Capabilities
- `prism-dispersion`: refraction of monochromatic and white light through a prism with dispersive glass, and the minimum-deviation experiment.

### Modified Capabilities

## Impact

- `src/physics/`: new `dispersion.ts`, `prism.ts`; `src/state/`, `src/education/`, new `src/components/surface/Prism*.tsx`; `docs/PHYSICS.md`, tests. The existing reflection and refraction experiments keep their 589 nm indices.
