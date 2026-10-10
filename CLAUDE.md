# Virtual Optics Laboratory

A virtual engineering optics laboratory (React + TypeScript + Vite, packaged for Windows with
Electron). Students perform experiments on a simulated bench and must obtain results consistent
with the underlying physics.

## Rules

### 1. Physics comes first

The application must never produce a physically impossible result merely because it looks visually
convincing.

For every visual behavior, ask:

> "What physical equation or optical principle determines this?"

Then implement that relationship.

The goal is not to create an optics-themed animation. The goal is to create a virtual engineering
optics laboratory where students can perform experiments and obtain results consistent with the
underlying physics.

In practice:

- Nothing on the screen is drawn by hand. Every visible quantity (position, size, blur, brightness,
  colour, fringe spacing) is computed by the physics layer from the bench layout.
- If a configuration is outside what the models cover, say so on screen or return a warning. Never
  show a plausible-looking guess.
- When a model is used outside its range of validity, the solver must report it.

### 2. Validate the physics before declaring a task complete

Before declaring a task complete, test each experiment manually and verify the numerical results
against the corresponding equations.

Do not mark a task complete simply because the UI works. The physics must also be validated.

In practice:

- Run the app (`npm run dev`) and work through every experiment the change could affect; for
  changes to shared physics or the solver, that means all of them (listed in
  `src/education/experiments.ts`).
- For each one, read the numbers the lab produces and compare them with a value calculated
  independently from the equation in `docs/PHYSICS.md` (e.g. 1/f = 1/do + 1/di, m = −di/do,
  n₁ sin θ₁ = n₂ sin θ₂, Δy = λL/d, λ = 2Δd/N).
- `npm test`, `npm run build` and `npm run lint` must pass, but passing tests alone are not
  validation of the running experiments.
- Report what was checked and the numbers obtained. If something could not be verified, say so
  rather than calling the task done.

## Commands

```bash
npm run dev        # start the lab at http://localhost:5173
npm test           # unit tests of the physics layer (vitest)
npm run build      # type-check and build
npm run lint       # oxlint
npm run desktop    # build and open in an Electron window
npm run dist:win   # build the portable Windows exe into release/
```

## Architecture

```text
bench layout (state) -> solveBench() -> { light at screen, numbers, overlay } -> bench / screen / panels
```

- `src/physics/` — pure TypeScript, no React or rendering. All optical formulas live here.
  `optics.ts` is the system solver that picks the model (geometric, Gaussian beam, wave) from the
  bench configuration.
- `src/state/` — lab state, actions, presets, demonstration sweeps.
- `src/education/` — experiment definitions and lab-notebook analysis.
- `src/render/` — rasterises the solver's result onto the screen canvas.
- `src/components/` — React UI. Contains no optical formulas.
- `electron/main.cjs` — desktop shell; only opens the built web app.

## Conventions

- All calculations are in SI units (metres, radians). Unit conversion happens only in
  `src/physics/units.ts`.
- Physical constants and hardware dimensions belong in `src/physics/constants.ts`.
- New or changed physics needs unit tests in `src/physics/__tests__/` that check against the
  analytical result, and an entry in `docs/PHYSICS.md` stating the equation, its assumptions and
  its limits.
- Zooming and panning change the pixel mapping and nothing else.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
