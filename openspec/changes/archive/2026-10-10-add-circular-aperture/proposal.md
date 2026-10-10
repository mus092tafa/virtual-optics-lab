# Proposal

## Why

Diffraction at a circular aperture sets the resolution limit of every optical instrument, and the lab has no experiment for it. The far-field machinery used for slits (ray-matrix distance, Fresnel-number check) carries over directly.

## What Changes

- New bench component: a circular aperture (pinhole) with diameter 0.05 to 0.5 mm.
- With the He-Ne laser the screen shows the Airy pattern I(θ) = [2 J₁(x)/x]², x = π D sin θ / λ, with the first dark ring at sin θ = 1.22 λ/D.
- The Fresnel number is reported, and the pattern is flagged when the far-field condition fails.
- The tungsten lamp with a pinhole is reported as not modelled.
- New experiment "Circular Aperture": determine the aperture diameter from the diameter of the first dark ring, D = 2.44 λ L / D_ring.

## Capabilities

### New Capabilities
- `circular-aperture-diffraction`: Fraunhofer diffraction of laser light at a circular aperture and the experiment built on it.

### Modified Capabilities

## Impact

- `src/physics/`: new `airy.ts` (Bessel J₁, Airy intensity), `types.ts`, `optics.ts`; `src/state/`, `src/education/`, `src/components/`; `docs/PHYSICS.md`, tests.
