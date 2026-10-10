# Proposal

## Why

The notebook reports each result as a bare number and a percentage error. Engineering students are expected to state a result with its uncertainty, to extract a quantity from a straight-line fit over several measurements, and to hand in a written report.

## What Changes

- Every measured quantity has a reading uncertainty (prefilled from the resolution of the instrument, editable). The notebook propagates the uncertainties to each result and reports value ± uncertainty, and states whether the accepted value lies within it.
- The notebook shows the mean and standard error of each result across the recorded rows.
- Experiments with a linear relationship get a graph of the recorded points with a least-squares line; the quantity of interest is read from the slope or intercept with its standard error.
- "Export report" downloads a self-contained HTML lab report for the current experiment (aim, equations, assumptions, set-up, measurements, graph, results) that can be printed to PDF.

## Capabilities

### New Capabilities
- `notebook-uncertainty`: reading uncertainties and their propagation to notebook results.
- `notebook-plot`: straight-line graph and least-squares fit of the recorded measurements.
- `lab-report`: exportable written report of an experiment.

### Modified Capabilities

## Impact

- `src/education/`: new `uncertainty.ts`, `fit.ts`, `labReport.ts`; `experiments.ts` (field uncertainties, plot definitions).
- `src/state/labState.ts` (notebook rows store uncertainties), `src/components/ExperimentPanel.tsx`, new `NotebookPlot.tsx`, CSS, README, tests. Saved notebooks without uncertainties remain loadable.
