# Proposal

## Why

The thin-lens and ray-matrix code already accepts a negative focal length, but the bench only offers convex lenses. Exposing diverging lenses lets students study virtual images and measure a negative focal length, with no new physical model.

## What Changes

- Lenses can be converging or diverging: focal lengths of −5, −10, −15, −20 and −30 cm are offered alongside the positive ones, with a concave glyph and a "Concave lens" palette entry.
- "Use unknown lens" keeps the lens type and picks an unknown magnitude.
- New experiment "Concave Lens — Focal Length": a convex lens forms a real image; the concave lens placed in the converging beam moves that image, and f follows from 1/f = 1/do + 1/di with a virtual object (do < 0).

## Capabilities

### New Capabilities
- `diverging-lens`: diverging thin lenses on the optical bench and the experiment that measures their focal length.

### Modified Capabilities

## Impact

- `src/physics/constants.ts`, `src/state/`, `src/education/experiments.ts`, `src/components/` (palette, controls, glyph, labels), `docs/PHYSICS.md`, tests. No change to the imaging equations.
