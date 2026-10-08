# Virtual Optics Laboratory

A browser-based optics laboratory for engineering students. Components are placed on an optical
bench, and what appears on the screen is calculated from the physical layout with standard optical
models. Nothing on the screen is drawn by hand: move the screen out of the image plane and the image
blurs; narrow a slit and the diffraction pattern widens.

```bash
npm install
npm run dev      # start the lab at http://localhost:5173
npm test         # 82 unit tests of the physics layer
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
read angles from a rotatable protractor. Partial reflection follows the Fresnel equations, and total
internal reflection appears beyond the critical angle.

**Section B — Optical bench.** A 150 cm rail seen from the side, with a millimetre scale. The left
panel is the physical setup; the right panel is the light arriving at the screen.

| Component | Properties |
| --- | --- |
| He-Ne laser | 632.8 nm (plus the 611.9, 594.1 and 543.5 nm He-Ne lines), TEM₀₀ Gaussian beam |
| Tungsten lamp | 2900 K black-body spectrum, adjustable intensity, adjustable source aperture |
| Convex lens | f = 5, 10, 15, 20, 30 cm; adjustable aperture; up to three lenses |
| Object | arrow, rectangle, circle, letter, cross; adjustable height |
| Single slit | width 0.02–0.5 mm, vertical or horizontal |
| Double slit | width and centre-to-centre separation, vertical or horizontal |
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

Each experiment has a guide and a lab notebook. The notebook turns recorded measurements into a
result (for example f from do and di, or λ from the fringe spacing) and, on request, compares it
with the accepted value and reports the percentage error.

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
    rayTransfer.ts    ABCD matrices, compound systems, defocus┘
    gaussianBeam.ts   laser beam propagation (q parameter)    ┐
    diffraction.ts    single slit, Fresnel number & integrals │ wave
    interference.ts   double slit, fringe spacing             │ optics
    slitPattern.ts    pattern on the screen (mono/polychromatic)│
    michelson.ts      two-beam interference in the interferometer┘
    spectrum.ts       Planck spectrum, CIE colour matching
    optics.ts         system solver: bench layout -> light at the screen
    __tests__/        unit tests
  state/          lab state, actions, presets, demonstration sweeps
  education/      experiment definitions and notebook analysis
  render/         rasterises the solver's result onto the screen canvas
  components/     React UI (bench SVG, screen, panels, Sections A and C)
```

The data flow is one-directional:

```text
bench layout (state) -> solveBench() -> { light at screen, numbers, overlay } -> bench / screen / panels
```

`solveBench` chooses the physical model from the configuration (geometric optics for imaging,
Gaussian beam optics for a bare laser, wave optics behind a slit) and returns warnings whenever a
model is used outside its range of validity. UI components contain no optical formulas.

**Adding a component** (for example a concave lens, a grating or a polariser): add its type to
`physics/types.ts`, teach `physics/optics.ts` what it does to the light, and add a glyph and controls
in `components/`. Elements that act on paraxial rays only need a ray-transfer matrix: a diverging
lens already works in `lenses.ts` and `rayTransfer.ts` with a negative focal length.

The physical models, their assumptions and their limits are documented in
[docs/PHYSICS.md](docs/PHYSICS.md).
