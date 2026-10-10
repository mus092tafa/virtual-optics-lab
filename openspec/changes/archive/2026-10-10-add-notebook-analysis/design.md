# Design

## Context

`ExperimentDefinition.analyze(values, context)` is a pure function from recorded numbers to results. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Uncertainty propagation and fitting that work for every experiment without per-experiment derivative code.

**Non-Goals:**
- Simulated random noise on instrument readings, weighted fits, non-linear fits.

## Decisions

- **Numerical propagation.** Because `analyze` is pure, ∂result/∂xᵢ is obtained by central differences on its inputs. One generic routine in `uncertainty.ts` covers all experiments, including new ones. Alternative considered: hand-written derivative per result. Rejected as duplicated physics that could drift from `analyze`.
- **Reading uncertainty, not injected noise.** The lab's instruments are exact; what a student lacks is the resolution with which a scale can be read. Each field declares that resolution. Adding random errors to displayed values would make the screen show something the solver did not compute.
- **Plot definition per experiment.** An optional `plot` on the definition maps a row to (x, y), names the axes and converts the fit into named results. Fitting lives in `fit.ts` as ordinary least squares with standard errors from the residuals.
- **Report as generated HTML.** A pure function builds the document string, which is downloaded like the existing CSV. It works the same in the browser and in the Electron shell and needs no dependency. The graph is embedded as inline SVG.

## Risks / Trade-offs

- [Central differences on a result with a kink give a poor derivative] → the step is a small fraction of the reading uncertainty, and results that are not finite are reported without an uncertainty.
