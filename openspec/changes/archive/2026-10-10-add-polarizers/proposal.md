# Proposal

## Why

The bench has no notion of polarisation, so Malus's law, one of the standard quantitative optics experiments, cannot be performed.

## What Changes

- New bench component: an ideal linear polariser with a rotatable transmission axis; up to three can be mounted.
- The solver tracks the polarisation state of the light along the bench: unpolarised light loses half its power at the first polariser, and linearly polarised light is transmitted according to I = I₀ cos²θ.
- The transmitted fraction scales the brightness of whatever reaches the screen and is reported as a relative-irradiance reading.
- New experiment "Malus's Law": record the reading against the analyser angle and compare with cos²θ.

## Capabilities

### New Capabilities
- `linear-polarizers`: ideal linear polarisers on the optical bench and the Malus's-law experiment.

### Modified Capabilities

## Impact

- `src/physics/`: new `polarization.ts`, `types.ts`, `optics.ts`; `src/state/`, `src/education/`, `src/components/`; `docs/PHYSICS.md`, tests.
