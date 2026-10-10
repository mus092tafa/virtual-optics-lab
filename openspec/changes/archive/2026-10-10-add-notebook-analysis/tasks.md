# Tasks

## 1. Uncertainty

- [x] 1.1 Add `uncertainty.ts` (numerical propagation, mean and standard error, agreement in σ) with tests against the analytic thin-lens result; `npm test` passes
- [x] 1.2 Give every measurement field a reading uncertainty, store uncertainties in notebook rows, and show value ± uncertainty, agreement and the summary row; verify in the app

## 2. Graph and fit

- [x] 2.1 Add `fit.ts` (least squares with standard errors and R²) with tests on exact and noisy lines; `npm test` passes
- [x] 2.2 Add plot definitions to the linear experiments and a notebook graph with the fitted line and derived quantity, with tests that ideal rows return the accepted value; verify the graph in the app

## 3. Report

- [x] 3.1 Add `labReport.ts` and the "Export report" button, with tests for content, withheld theory and escaping; verify the downloaded file opens and prints
- [x] 3.2 Describe the notebook analysis in the README
