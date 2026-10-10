# Virtual Optics Laboratory

A browser-based optics laboratory for engineering students. Components are placed on an optical
bench, and what appears on the screen is calculated from the physical layout with standard optical
models. Nothing on the screen is drawn by hand: move the screen out of the image plane and the image
blurs; narrow a slit and the diffraction pattern widens.

```bash
npm install
npm run dev      # start the lab at http://localhost:5173
npm test         # 185 unit tests: physics, notebook analysis, every experiment
npm run build    # type-check and build for production
npm run lint
```

## Windows desktop app

```bash
npm run desktop    # build and open the lab in a desktop window
npm run dist:win   # build release/VirtualOpticsLab-<version>-portable.exe
```

The portable exe is a single file that runs on 64-bit Windows 10/11 without installation. It is
not code-signed, so Windows SmartScreen asks for confirmation on first launch (*More info → Run
anyway*). The desktop shell in `electron/main.cjs` only opens the built web app in a window.

## The laboratory

**Section A — Reflection and refraction.** A laser ray meets a plane mirror or an interface between
two media. Drag the laser around the point of incidence, tilt the surface, choose the materials, and
read angles from a rotatable protractor. Partial reflection follows the Fresnel equations for
unpolarised, s- or p-polarised light, and total internal reflection appears beyond the critical
angle. A second scene shows a ray, or a fan of white light, refracted through a glass prism whose
index depends on wavelength.

**Section B — Optical bench.** A 150 cm rail seen from the side, with a millimetre scale. The left
panel is the physical setup; the right panel is the light arriving at the screen.

| Component | Properties |
| --- | --- |
| He-Ne laser | 632.8 nm (plus the 611.9, 594.1 and 543.5 nm He-Ne lines), TEM₀₀ Gaussian beam |
| Tungsten lamp | 2900 K black-body spectrum, adjustable intensity, adjustable source aperture |
| Convex / concave lens | f = ±5, ±10, ±15, ±20, ±30 cm; adjustable aperture; up to three lenses |
| Spherical mirror | concave or convex, f = ±10, ±15, ±20, ±30 cm (R = 2f); adjustable aperture |
| Object | arrow, rectangle, circle, letter, cross; adjustable height |
| Single slit | width 0.02–0.5 mm, vertical or horizontal |
| Double slit | width and centre-to-centre separation, vertical or horizontal |
| Diffraction grating | 100, 300 or 600 lines/mm; open width 0.5–10 mm; lines vertical or horizontal |
| Circular aperture | diameter 0.05–0.5 mm |
| Polariser | ideal linear polariser, axis 0–180°; up to three |
| Screen | 12 cm × 12 cm observation plane |

**Section C — Interferometer.** A Michelson interferometer seen from above: He-Ne laser, expander
lens, beam splitter, fixed mirror M1, and mirror M2 on a micrometer stage with tilt screws. The
screen shows circular fringes when the mirrors are aligned and straight fringes when M2 is tilted.
A fringe counter and a motorised scan let students measure the wavelength from λ = 2Δd/N.

### Experiments

1. Law of reflection
2. Refraction (Snell's law)
3. Convex lens: focal length from object and image distances
4. Lens magnification
5. He-Ne laser through a lens
6. Single-slit diffraction
7. Double-slit interference
8. Tungsten light source
9. Michelson interferometer: wavelength from fringe counting
10. Concave lens: focal length from a virtual object
11. Diffraction grating: wavelength from the order positions
12. Circular aperture: diameter from the Airy pattern
13. Polarisation: Malus's law
14. Brewster's angle: refractive index from the angle of zero reflection
15. Prism: refractive index by minimum deviation, and dispersion
16. Concave mirror: focal length and radius of curvature

Each experiment has a guide and a lab notebook. The notebook turns recorded measurements into a
result (for example f from do and di, or λ from the fringe spacing) and, on request, compares it
with the accepted value and reports the percentage error.

### Lab notebook

- **Uncertainties.** Each measured quantity has a reading uncertainty, prefilled with the resolution
  of the instrument and editable. The notebook propagates them and reports every result as
  value ± uncertainty, and says whether the accepted value lies within it.
- **Repeated measurements.** With two or more rows the notebook shows the mean and standard error
  of each quantity that belongs to the apparatus.
- **Graph.** Experiments with a linear relation plot the recorded rows in linearised form (for
  example 1/di against 1/do) with a least-squares line, and read the result off the slope or
  intercept with its standard error. Three rows are needed for a fit.
- **Report.** *Export report* downloads a self-contained HTML lab report (aim, procedure, theory,
  set-up, measurements, graph, results) that can be printed to PDF. Accepted values appear in it
  only if the theory is visible when it is exported. *Export CSV* saves the table.

### Modes

- **Experiment** — calculated results (image distance, magnification, fringe spacing, the focus
  indicator, ray diagrams) are withheld until the student chooses *Reveal theory*. A lens can be
  swapped for one of unknown focal length.
- **Learning** — all values, equations and model assumptions are shown.
- **Demonstration** — as Learning, plus an automatic sweep of the experiment's key parameter.

### Measurement tools

- Rail scale, position tags and the distance between neighbouring components
- Cursor coordinates on the bench (x in cm, y in mm)
- Ruler tool: drag on the bench to measure a distance
- Screen graticule in mm, cursor read-out, and drag-to-measure (image height, fringe spacing)
- Intensity profile across the pattern
- Protractor (Section A)

### Using the bench

Click a component in the list to mount it, then drag it along the rail. Arrow keys move the selected
component by 1 mm (Shift: 1 cm); Delete removes it. Scroll to zoom the bench or the screen; drag the
bench background to pan. **Save** downloads the configuration as a JSON file and **Load** restores
one; the current state is also kept in the browser between visits.

## Architecture

```text
src/
  physics/        Pure TypeScript, SI units, no rendering or React
    units.ts          the only place unit conversion happens
    constants.ts      wavelengths, refractive indices, hardware dimensions
    reflection.ts     law of reflection                      ┐
    refraction.ts     Snell, critical angle, Fresnel          │ geometric
    surface.ts        ray at a mirror / interface             │ optics
    lenses.ts         thin lens, magnification, principal rays│
    rayTransfer.ts    ABCD matrices, compound systems, defocus│
    dispersion.ts     Sellmeier indices of optical glasses    │
    prism.ts          ray through a prism, minimum deviation  ┘
    gaussianBeam.ts   laser beam propagation (q parameter)    ┐
    diffraction.ts    single slit, Fresnel number & integrals │ wave
    interference.ts   double slit, fringe spacing             │ optics
    slitPattern.ts    pattern on the screen (mono/polychromatic)│
    grating.ts        diffraction grating: orders, spectra    │
    airy.ts           circular aperture (Airy pattern)        │
    polarization.ts   linear polarisers, Malus's law          │
    michelson.ts      two-beam interference in the interferometer┘
    spectrum.ts       Planck spectrum, CIE colour matching
    optics.ts         system solver: bench layout -> light at the screen
    __tests__/        unit tests
  state/          lab state, actions, presets, demonstration sweeps
  education/      experiment definitions and notebook analysis
    experiments.ts    guides, measurement fields, analysis, graphs
    uncertainty.ts    propagation of reading uncertainties
    fit.ts            least-squares line
    notebook.ts       results, summary and fit of the recorded rows
    labReport.ts      exportable HTML report
  render/         rasterises the solver's result onto the screen canvas
  components/     React UI (bench SVG, screen, panels, Sections A and C)
```

The data flow is one-directional:

```text
bench layout (state) -> solveBench() -> { light at screen, numbers, overlay } -> bench / screen / panels
```

`solveBench` chooses the physical model from the configuration (geometric optics for imaging,
Gaussian beam optics for a bare laser, wave optics behind a slit, grating or pinhole) and returns warnings whenever a
model is used outside its range of validity. UI components contain no optical formulas.

**Adding a component**: add its type to `physics/types.ts`, teach `physics/optics.ts` what it does
to the light, and add a glyph, a palette entry and controls in `components/`. Elements that act on
paraxial rays only need a ray-transfer matrix. Give a new experiment a preset in `state/presets.ts`,
a definition in `education/experiments.ts` and a regression test in
`education/__tests__/experiments.test.ts`.

**Development workflow.** Changes are planned as OpenSpec changes under `openspec/` (the behaviour
contracts of the lab are in `openspec/specs/`), and `.github/workflows/ci.yml` runs lint, the tests
and the build on every push and pull request.

The physical models, their assumptions and their limits are documented in
[docs/PHYSICS.md](docs/PHYSICS.md).
