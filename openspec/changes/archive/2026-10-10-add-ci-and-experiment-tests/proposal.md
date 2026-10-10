# Proposal

## Why

Nothing runs the tests, type-check or lint when code is pushed, and no test loads an experiment the way the app does. A change to shared physics can break an experiment without any check failing.

## What Changes

- GitHub Actions workflow running lint, the unit tests and the production build on every push and pull request.
- A regression test per experiment: load its preset, solve it, compare the solver's numbers with the governing equation evaluated independently, and feed ideal measurements through the notebook analysis.
- A structural test that every experiment id has a definition, a section, a preset and a sweep label.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- New `.github/workflows/ci.yml` and `src/education/__tests__/experiments.test.ts`. No change in application behaviour.
