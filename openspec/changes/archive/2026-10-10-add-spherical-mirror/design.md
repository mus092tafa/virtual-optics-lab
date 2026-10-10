# Design

## Context

`solveBench` assumes light travels in +x from the source to the screen. A mirror folds the path. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Reuse the thin-lens imaging, ray-tracing and Gaussian-beam code unchanged for the reflected path.

**Non-Goals:**
- Lenses or apertures in a path that contains a mirror (double pass), plane mirrors, spherical aberration.

## Decisions

- **Unfold the path.** In the paraxial approximation a spherical mirror of focal length f acts on rays exactly like a thin lens of the same f followed by a reversal of the axis. The solver replaces the mirror by a virtual lens at x_m and the screen by its reflection at 2 x_m − x_s, runs the existing imaging or beam solution, then maps every overlay point beyond x_m back with x → 2 x_m − x. Alternative considered: a general bidirectional ray tracer. Rejected as far larger than the one case needed.
- **The screen does not shadow the incoming light.** In the laboratory the mirror is tilted by a small angle so that the returning light lands on a half-screen beside the object. The model takes that tilt as negligible (paraxial) and lets a screen between the object and the mirror receive reflected light without blocking the incident light. This is stated as a model assumption and as a notice on the bench.
- **Polarisers are applied in the order the light meets them**, including a second pass on the way back.

## Risks / Trade-offs

- [The idealised half-screen could look like light passing through a screen] → an on-bench notice explains the off-axis arrangement whenever a mirror is in use.
