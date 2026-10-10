# Proposal

## Why

Image formation by a concave mirror is a core geometric-optics experiment, and it obeys the same conjugate equation as the thin lens with f = R/2. The bench only handles light travelling one way along the rail, so mirrors are missing.

## What Changes

- New bench component: a spherical mirror, concave (f > 0) or convex (f < 0), with selectable focal length and aperture.
- Light reaching the mirror is reflected back along the rail. A screen in front of the mirror receives the reflected light; the image position, magnification and defocus follow 1/f = 1/do + 1/di and m = −di/do.
- The laser beam is reflected and refocused according to the same q-parameter rule as a lens of focal length f.
- Combinations the model does not cover (a lens, slit, grating or pinhole in front of the mirror) are reported as not modelled.
- New experiment "Concave Mirror — Focal Length".

## Capabilities

### New Capabilities
- `spherical-mirror`: image formation by a spherical mirror on the optical bench and the focal-length experiment.

### Modified Capabilities

## Impact

- `src/physics/types.ts`, `optics.ts`, `constants.ts`; `src/state/`, `src/education/`, `src/components/`; `docs/PHYSICS.md`, tests.
