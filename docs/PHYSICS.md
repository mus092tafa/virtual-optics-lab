# Physical models and assumptions

Every quantity shown in the laboratory comes from the equations below. All calculations use SI units
(metres, radians); conversions happen only in `src/physics/units.ts`. Zooming changes the pixel
mapping and nothing else.

The solver (`src/physics/optics.ts`) selects the model from what is on the bench:

| Configuration | Model |
| --- | --- |
| Ray at a mirror or interface (Section A) | geometric optics |
| Source + object + lens(es) + screen | geometric optics (thin lens, ray-transfer matrices) |
| Tungsten lamp + lens(es), no object | geometric optics; the lamp aperture is the object |
| He-Ne laser (+ lenses), no slit or object | Gaussian beam optics |
| Any source + single or double slit | wave optics (Fraunhofer, optionally Fresnel) |
| Any source + diffraction grating | wave optics (grating equation; deflected Gaussian beams or projected spectra) |
| He-Ne laser + circular aperture | wave optics (Fraunhofer, Airy pattern) |
| Spherical mirror in the path | geometric or Gaussian beam optics on the unfolded axis |
| Polarisers in the path | scale the power only (Malus's law) |
| Ray through a prism (Section A) | geometric optics with dispersive glass |
| Object together with a slit, grating or pinhole | not modelled: the screen says so instead of showing a guess |
| Two diffracting elements; lens behind a grating; lamp + pinhole; lens or aperture in front of a mirror | not modelled, reported the same way |
| Michelson interferometer (Section C) | wave optics: interference of two Gaussian beams |

## 1. Reflection — `reflection.ts`, `surface.ts`

- Law of reflection: θr = θi, both from the normal. The reflected direction is
  r = d − 2(d·n̂)n̂.
- Rotating the mirror by α turns the reflected ray by 2α.
- Assumptions: flat, perfectly specular front-surface mirror; light arriving at the back is
  absorbed.

## 2. Refraction — `refraction.ts`, `surface.ts`

- Snell's law: n₁ sin θ₁ = n₂ sin θ₂.
- Critical angle θc = sin⁻¹(n₂/n₁) for n₁ > n₂; beyond it the light is totally internally reflected.
- The reflected and transmitted powers are the Fresnel coefficients for unpolarised light,
  R = (Rs + Rp)/2 and T = 1 − R. They set the brightness of the two rays.
- Assumptions: homogeneous, isotropic, non-absorbing media; indices at 589 nm (sodium D line), so
  dispersion is ignored even though the ray is drawn as a red laser. (The prism experiment, §15,
  uses wavelength-dependent indices.)

### Polarisation and Brewster's angle

- The ray can be unpolarised, s-polarised (electric field perpendicular to the plane of incidence)
  or p-polarised (in the plane of incidence). The Fresnel power reflectances are

      Rs = [(n₁ cos θ₁ − n₂ cos θ₂) / (n₁ cos θ₁ + n₂ cos θ₂)]²
      Rp = [(n₂ cos θ₁ − n₁ cos θ₂) / (n₂ cos θ₁ + n₁ cos θ₂)]²

  and the reflected fraction is Rs, Rp or (Rs + Rp)/2 accordingly; the transmitted fraction is one
  minus that.
- Rp vanishes at Brewster's angle, tan θ_B = n₂/n₁, where the reflected and refracted rays are
  perpendicular. From a measured θ_B, n₂ = n₁ tan θ_B.
- Ray brightness follows the power in the ray. A ray that carries no power is not drawn, so the
  reflected ray disappears at θ_B for p-polarised light.

## 3. Thin lens imaging — `lenses.ts`, `rayTransfer.ts`

- Thin lens equation 1/f = 1/do + 1/di, with real-is-positive signs: do > 0 for a real object,
  di > 0 for a real image, f > 0 for a converging lens.
- Magnification m = hi/ho = −di/do. m < 0: inverted. |m| > 1: magnified.
- Object in the focal plane: image at infinity. Object inside f: virtual, upright, magnified image,
  which cannot be caught on the screen.
- Several lenses: the image of one lens is the object of the next. The same result is obtained from
  the product of ray-transfer (ABCD) matrices, where the image plane is where B = 0 and m = A.
- Diverging (concave) lenses are the same equations with f < 0. A real object gives a virtual,
  upright, reduced image on the object side. Placed in the converging light behind a convex lens,
  a diverging lens has a virtual object (do < 0): with s the distance from the lens to the image it
  intercepts, 1/di = 1/f + 1/s, and the image is real only while s < |f|. This is how the
  concave-lens experiment measures a negative focal length: f = (1/di − 1/s)⁻¹.
- Principal rays are generated from the lens law (parallel ray through the back focal point, central
  ray undeviated, focal ray leaving parallel). The unit tests check that all three meet at the
  calculated image point.
- The object stands on the optical axis and extends upward to its height ho, as in a textbook ray
  diagram. The screen is viewed looking along the direction of the light, so a real image appears
  rotated by 180°.
- Assumptions: thin lenses, paraxial rays (no aberrations), geometric optics (no diffraction at the
  lens aperture), a uniformly lit diffusing object.

### Screen focus

A point of the object sends a cone of rays through the lens aperture (diameter D). The cone
converges to the image point; a screen elsewhere cuts it in a disc of diameter

    c = D · |s − di| / |di|        (s: lens-to-screen distance)

In matrix form, a ray (y, u) from the object reaches the screen at A·y + B·u, so the blur diameter
is 2|B|·u_max, where u_max is the marginal ray slope set by the aperture stop. The picture is centred
on the chief ray, giving a scale of −s/do for a single lens.

The screen image is the object's shape at that scale, convolved with a uniform disc of diameter c.
The convolution conserves energy, so an out-of-focus image is both blurred and dimmer. The blur is
zero only in the image plane. A smaller lens aperture gives less blur (greater depth of focus).

This is a geometric approximation of defocus. It ignores diffraction (the Airy pattern) and lens
aberrations, which matter only for blur much smaller than a pixel here.

### Brightness

For a diffusing object of radiance L, the image irradiance is E = L·π·u_max²/scale², which for one
lens is L·πD²/(4s²). The lamp intensity multiplies L and nothing else: it changes brightness, never
geometry. With no lens between object and screen, every object point lights the whole screen and the
solver returns uniform illumination.

**Display convention.** The screen brightness is auto-ranged to the geometry: the nominal peak
irradiance at 100% source power maps to full brightness. Changing the lamp intensity scales the
brightness linearly from there. The exposure slider is a camera gain for seeing faint structure such
as diffraction side lobes; over-exposed regions saturate towards white.

## 4. He-Ne laser — `gaussianBeam.ts`

- λ = 632.8 nm, TEM₀₀ Gaussian beam with waist radius w₀ = 0.405 mm at the output aperture. This
  gives a full-angle divergence 2λ/(πw₀) ≈ 1.0 mrad and a Rayleigh range z_R = πw₀²/λ ≈ 81 cm, as
  for a small laboratory He-Ne tube.
- Free space: w(z) = w₀√(1 + (z/z_R)²). In general the complex beam parameter q is propagated with
  q′ = q + d and 1/q′ = 1/q − 1/f at a thin lens.
- The screen shows I(r) = I₀ exp(−2r²/w²) with the calculated radius w.
- A lens focuses the beam to a waist close to (not exactly at) the focal plane; the waist radius is
  approximately λf/(πw_lens).
- Assumptions: paraxial, ideal single-mode beam; lenses do not clip the beam (a warning appears if
  the beam is wider than a third of the aperture).
- The beam is drawn at its true 1/e² radius, which is about one pixel. The optional "Beam ×25"
  setting exaggerates the drawn width only.
- A laser pointed at the object lights a spot about 1 mm wide; the object is then imaged with that
  Gaussian illumination profile.

## 5. Single-slit diffraction — `diffraction.ts`

- Fraunhofer pattern: I(θ) = I₀[sin β/β]², β = πa sin θ/λ.
- Minima at a sin θ = mλ. Central maximum full width W = 2L tan θ₁ ≈ 2λL/a.
- On the screen, sin θ = x/√(x² + L²) at position x.

## 6. Double-slit interference — `interference.ts`

- Ideal slits: I(θ) ∝ cos²δ, δ = πd sin θ/λ.
- Finite slits: I(θ) = I₀[sin β/β]² cos²δ. The fringes sit inside the single-slit envelope.
- Fringe spacing Δy = λL/d. Orders where d/a is an integer fall on envelope zeros and are missing.

## 7. Range of validity of the Fraunhofer model

The Fraunhofer formulas require the Fresnel number N_F = r²/(λL) ≪ 1, where r is the half-extent of
the aperture (a/2 for one slit, (d + a)/2 for two). The laboratory reports N_F and classifies it:

| N_F | Regime | Behaviour |
| --- | --- | --- |
| < 0.1 | far field | Fraunhofer pattern, no warning |
| 0.1 – 1 | marginal | warning: the pattern is approximate |
| ≥ 1 | near field | error message: the Fraunhofer result shown is not valid |

A **Fresnel** model can be selected instead. It evaluates the Fresnel diffraction integral for the
slits exactly, using the Fresnel integrals C and S:

    I(x) = ½ |Σ_slits [F(u₂) − F(u₁)]|²,   u = √(2/(λL))·(ξ − x),   F = C + iS

It reproduces the geometric shadow of the slit with edge ripples close to the slit, and converges to
the Fraunhofer pattern far away (checked in the unit tests).

**Lenses and curved wavefronts.** The space between slit and screen is described by a ray-transfer
matrix (A, B), and the illumination by its wavefront radius R at the slit (from the Gaussian beam for
the laser). By the Collins integral this is Fresnel diffraction at an effective distance
L_e = B/M seen with magnification M = A + B/R. In the far-field limit the pattern depends only on B
(sin θ → x/B). A screen in the focal plane of a lens therefore shows the Fraunhofer pattern with
L replaced by f, exactly.

Other assumptions: scalar diffraction; slits much longer than wide; uniform illumination of the
aperture (a warning appears when the laser beam is too narrow for this); thin lenses that do not
clip the diffracted light.

## 8. Tungsten light — `spectrum.ts`, `slitPattern.ts`

- Spectrum: Planck's law at T = 2900 K, sampled in 35 bands from 390 to 730 nm. The colour temperature
  is held fixed when the intensity is changed (as with a neutral-density filter; a real lamp reddens
  when dimmed).
- Colour: each band is converted with the CIE 1931 colour-matching functions (analytic fit of Wyman,
  Sloan and Shirley, 2013) to linear sRGB. A monochromatic laser line uses the same conversion,
  clipped to the display gamut.
- Extended source: the lamp has an emitting aperture of adjustable diameter.
- Behind a slit, the light is incoherent between wavelengths and between source points, so
  intensities add:
  - each wavelength forms its own pattern (width ∝ λ), giving a white central fringe and coloured
    outer fringes;
  - each source point shifts the pattern, so a source of width W at distance L_s smears it over
    W·L/L_s. When this exceeds the fringe spacing the fringes disappear. A small or distant source is
    needed to see white-light fringes, which is why the laser is used for these experiments.

- Behind a grating the lamp is sampled in 100 bands, because each band lands at its own position.

## 9. Michelson interferometer — `michelson.ts`

The laser beam is split into two arms, reflected by M1 (fixed) and M2 (movable), and recombined on
the screen. Moving M2 by d from the equal-arm position changes the optical path difference by 2d.

- Each arm delivers a Gaussian beam to the screen. Its radius w, wavefront curvature 1/R and Gouy
  phase come from the ray-transfer matrix of the unfolded path (laser → expander lens → splitter →
  mirror → splitter → screen), with path lengths z₁ and z₂ = z₁ + 2d.
- The screen intensity is two-beam interference, I = |E₁|² + |E₂|² + 2|E₁||E₂| cos Δφ, with

      Δφ = k·2d + (k/2)(ρ₂²/R₂ − ρ₁²/R₁) + k·2α·x + Gouy difference + π

- **Circular fringes.** With the expander lens the beams diverge from two virtual sources one behind
  the other, 2d apart. Their wavefronts have different curvature, which gives rings obeying
  2d cos θ = mλ. The rings grow as d → 0.
- **Straight fringes.** Tilting M2 by α turns its beam by 2α. The virtual sources are then side by
  side and the fringes are straight, with spacing λz/(2α·s), where s is the distance from the
  source to M2 and z the distance from the source to the screen. Tilt combined with a path
  difference gives off-centre, curved fringes.
- **Fringe counting.** The order at the centre is 2d/λ, so one fringe passes for every λ/2 of mirror
  travel and λ = 2Δd/N. The fringe counter reports the whole number of fringes passed since reset.
- **Zero path difference.** One beam is reflected at the outside of the splitter coating and the
  other at the inside, a phase difference of π. With equal arms and aligned mirrors the screen is
  therefore dark, and the light returns towards the laser.
- Assumptions: ideal 50/50 splitter of negligible thickness (so no compensator plate is needed);
  perfect mirrors; a perfectly coherent laser (contrast does not fall with path difference);
  paraxial Gaussian beams; the expander lens does not clip the beam. Each beam undergoes one
  reflection and one transmission at the splitter, so the two have equal amplitude.
- Not modelled: white-light fringes, the finite coherence length of a multimode He-Ne laser, and
  dispersion in the splitter glass.

## 10. Spherical mirror — `optics.ts`

- Mirror equation 1/f = 1/do + 1/di with f = R/2 and magnification m = −di/do. Distances are
  positive in front of the mirror: di > 0 is a real image on the object's side, di < 0 a virtual
  image behind the mirror. f > 0 is a concave mirror, f < 0 a convex one.
- In the paraxial approximation a mirror acts on rays exactly like a thin lens of the same focal
  length followed by a reversal of the axis. The solver therefore *unfolds* the path: the mirror at
  x_m becomes a thin lens, and a screen at x_s in the reflected light sits at 2x_m − x_s. Imaging,
  defocus, ray tracing and the Gaussian beam are computed with the lens code; every drawn point
  beyond x_m is then mapped back with x → 2x_m − x. Defocus is c = D·|s − di|/|di| with D the mirror
  aperture and s the mirror-to-screen distance.
- A laser beam is transformed by 1/q′ = 1/q − 1/f at the mirror.
- **Off-axis screen.** A screen on the axis would shadow the incoming light. In the laboratory the
  mirror is tilted by a small angle so that the returning light lands on a half-screen beside the
  object. The model takes that tilt as negligible: a screen in front of the mirror receives the
  reflected light and does not block the incident light. A screen behind the mirror is dark.
- Assumptions: paraxial rays (no spherical aberration), a perfectly reflecting surface.
- Not modelled: a lens, slit, grating or pinhole in front of the mirror, because the light would
  pass it twice. The solver reports this instead of showing a result.

## 11. Polarisers — `polarization.ts`

- Unpolarised light through an ideal linear polariser: half the power is transmitted, polarised
  along the transmission axis.
- Linearly polarised light: I = I₀ cos²θ (Malus's law), θ between the polarisation and the axis.
- The solver passes the light through the polarisers in the order it meets them and multiplies the
  source power by the product. Position, size, focus and fringe spacing are untouched.
- With a mirror, light meets the polarisers in front of it a second time on the way back.
- The transmitted fraction is reported as the relative irradiance at the screen (a detector
  reading), and the light drawn on the bench is dimmed past each polariser.
- Assumptions: ideal polarisers (complete extinction, no loss along the axis); both sources are
  unpolarised (the He-Ne is taken as a randomly polarised tube).

## 12. Diffraction grating — `grating.ts`

- Grating equation at normal incidence: d sin θ_m = mλ. Order m lands at y = L tan θ_m on a screen
  a distance L behind the grating. Orders with |mλ/d| ≥ 1 do not exist. No small-angle
  approximation is made: first-order angles are 11° (300 lines/mm) to 22° (600 lines/mm).
- Order strength: a thin amplitude grating with open fraction a/d sends the fraction
  η_m = (a/d)² [sin(πm a/d)/(πm a/d)]² of the incident power into order m. The lab uses a/d = 0.3,
  so no order up to the third is missing.
- **Laser.** When the beam covers many lines, the field behind the grating is a sum of copies of
  the incident Gaussian beam, one per order. In the plane of dispersion the copy has beam parameter
  q′ = q cos²θ_m (its width is foreshortened by cos θ_m), travels L/cos θ_m, and its footprint on
  the flat screen is stretched by 1/cos θ_m. For a waist of radius w at the grating the footprint
  radius is √(w² + (λL/(πw cos³θ_m))²). Across the dispersion the radius is that of the beam after
  L/cos θ_m. The N-slit Fraunhofer formula is not used: the illuminated width (about 1 mm) puts the
  screen in the near field of the grating as a whole (N_F > 1).
- **Tungsten lamp.** A ray from source point s through aperture point ξ arrives with slope
  α = ξ/R − s/B (R: wavefront radius, B: ray-matrix element from the source) and leaves with
  sin θ = sin α + mλ/d. One wavelength in one order therefore fills a patch that is the convolution
  of two boxes, of widths W·|1 + (L/R) sec³θ| (grating open width W) and s·(L/|B|) sec³θ (source
  size s). The patches of all wavelengths and orders add in intensity. Narrowing the open width
  sharpens the spectrum and dims it in proportion.
- Brightness is relative to the centre of the zeroth order with the full ruled width (10 mm) open.
- Assumptions: normal incidence; scalar diffraction (the efficiencies are approximate for the
  600 lines/mm grating, whose slits are narrower than a wavelength; the angles are exact).
- Not modelled: a lens between the grating and the screen (the thin-lens model is paraxial), a
  slit and grating together, truncation of the laser beam by the grating aperture (a warning
  appears when the beam is wider than a third of the open width).

## 13. Circular aperture — `airy.ts`

- Fraunhofer pattern of a circular aperture of diameter D: I(θ) = I₀[2J₁(x)/x]², x = πD sin θ/λ.
- First dark ring at x = 3.8317, i.e. sin θ = 1.22λ/D; its radius on the screen is 1.22λL/D. The
  first bright ring peaks at 1.75 % of the central intensity, so the exposure has to be raised to
  see it.
- J₁ is evaluated by its power series for |x| ≤ 12 and the Hankel asymptotic expansion beyond.
- Validity is checked exactly as for slits (§7) with r = D/2; lenses and the curvature of the
  illuminating wavefront enter through the same ray-matrix distance B.
- Assumptions: uniform coherent illumination (a warning appears when the aperture is wider than the
  uniform part of the laser beam); scalar diffraction.
- Not modelled: the tungsten lamp behind a pinhole, and the near field (no Fresnel model for the
  circular aperture; the lab reports an error instead).

## 14. Dispersion — `dispersion.ts`

- Refractive index of the prism glasses from the three-term Sellmeier equation
  n²(λ) = 1 + Σ Bᵢλ²/(λ² − Cᵢ), with the published coefficients for Schott BK7, F2 and SF10 and for
  fused silica (Malitson).
- The unit tests pin n_d (587.6 nm) and the Abbe number of each glass to the catalogue values
  (BK7: 1.5168, 64.17; F2: 1.6200, 36.37; SF10: 1.7283, 28.53; fused silica: 1.4585, 67.82).

## 15. Prism — `prism.ts`

- First face: sin θ₁ = n sin θ₁′. Inside: θ₁′ + θ₂′ = A (apex angle). Second face:
  n sin θ₂′ = sin θ₂. Deviation δ = θ₁ + θ₂ − A.
- δ is smallest for the symmetric passage θ₁ = θ₂, where n = sin((A + δ_min)/2)/sin(A/2).
- The ray is traced with the vector form of Snell's law, so no small-angle approximation is made.
  White light is traced as seven wavelengths from 420 to 680 nm, each with its own index.
- When n sin θ₂′ > 1 the ray is totally reflected at the second face and no emergent ray is drawn.
  If the refracted ray reaches the base before the second face, that path is reported as not
  modelled.
- Transmitted power: Fresnel transmission for unpolarised light at both faces; it sets the
  brightness of the emergent ray.
- The deviation is shown as an instrument reading in every mode (in a real laboratory it is read
  from the spectrometer table); the index is what the student determines.
- Assumptions: a single ray, the prism in air, no absorption, no multiple internal reflections.

## 16. Lab notebook — `src/education/`

- **Reading uncertainty.** Every measured quantity has an uncertainty Δx, prefilled with the
  resolution of the instrument (0.1 cm for a rail distance, 0.5° for the protractor, and so on) and
  editable. These describe how well a scale can be read; no random error is added to anything the
  lab displays.
- **Propagation** (`uncertainty.ts`). For a result q(x₁, …, xₙ) of independent readings,
  Δq = √(Σ (∂q/∂xᵢ · Δxᵢ)²). Each term is evaluated numerically from the analysis function itself
  as [q(xᵢ + Δxᵢ) − q(xᵢ − Δxᵢ)]/2.
- **Repeated measurements.** For quantities that belong to the apparatus (a focal length, a
  wavelength) the notebook gives the mean and its standard error s/√n. Quantities that change with
  the setting (an angle, a magnification) are not averaged.
- **Straight-line fit** (`fit.ts`). Unweighted least squares for y = a + bx with standard errors
  σ_b = √(s²/S_xx) and σ_a = √(s²(1/n + x̄²/S_xx)), s² = Σr²/(n − 2). Each experiment that has a
  linear relation plots its rows in the linearising variables (for example 1/di against 1/do) and
  derives its quantity from the slope or intercept, with the uncertainty that follows from the
  standard error.
- Agreement with the accepted value is stated in units of the uncertainty.

## 17. Rendering

`src/render/screenRenderer.ts` converts the solver's result to pixels: for each screen position it
takes the calculated irradiance, applies the exposure gain and a display gamma of 2.2. Patterns are
sampled three times per pixel and averaged in linear light so fine fringes do not alias.

## 18. Known limitations

- Paraxial optics throughout: no spherical or chromatic aberration.
- No vignetting of off-axis object points; no diffraction limit of the lens.
- Laser speckle and the laser's coherence length are not modelled.
- One source, one object, one diffracting element (slit, double slit, grating or pinhole), one
  mirror and one screen can be mounted at a time; up to three lenses and three polarisers.
- An object and a diffracting element in the same light path are not modelled.
- No lens behind a grating, no lens or aperture in front of a mirror, no white light at a pinhole.
- Polarisers are ideal; the reflection and refraction experiments keep fixed 589 nm indices.

## 19. Validation

`npm test` runs 185 tests of the physics layer, the notebook analysis and every experiment preset,
including:

| Check | Expected |
| --- | --- |
| Reflection at θi = 30° | θr = 30° |
| Snell's law, air to water at 45° | θ₂ = 32.0°; n₁ sin θ₁ = n₂ sin θ₂ for all material pairs |
| Glass to air | critical angle 41.81° for n = 1.5; total reflection beyond |
| Thin lens f = 10 cm, do = 30 cm | di = 15 cm, m = −0.5, real, inverted, reduced |
| Principal rays | all three meet at the calculated image point |
| Screen focus | blur 0 at the image plane; 10 mm at s = 25 cm for di = 20 cm, D = 40 mm |
| Lamp intensity | changes brightness, leaves image position, size and blur unchanged |
| Single slit | zeros at a sin θ = mλ; narrower slit gives a wider central maximum |
| Double slit | larger separation gives smaller fringe spacing; dark fringes spaced λL/d |
| Wavelength | longer wavelength gives wider diffraction and fringe spacing |
| Fresnel integrals | tabulated values of C(x), S(x) |
| Fresnel model | converges to Fraunhofer in the far field |
| Extended source | fringe visibility falls as the source grows |
| Gaussian beam | 1 mrad divergence; focal shift formula; 3× beam expander |
| Michelson | dark at zero path difference; one fringe per λ/2; λ = 2Δd/N; rings obey 2d cos θ = mλ; tilt fringe spacing |
| Diverging lens | f = −15 cm, do = 30 cm: di = −10 cm, m = +1/3; virtual object 10 cm behind it: di = 30 cm |
| Spherical mirror | f = 20 cm, do = 30 cm: di = 60 cm, m = −2; reflected principal rays meet at the image point |
| Polarisers | ½ for unpolarised light; cos²θ; crossed: 0; third polariser at 45°: 1/8 |
| Brewster | Rp = 0 at tan⁻¹(n₂/n₁) = 56.60° for air → crown glass; Rp = Rs² at 45° |
| Grating | 300 lines/mm, 632.8 nm, L = 25 cm: first order at 48.34 mm; efficiencies sum to a/d |
| Airy pattern | J₁ against tabulated values; first dark ring at 1.22 λL/D; first bright ring 1.75 % |
| Dispersion | n_d and Abbe number of each glass equal the catalogue values |
| Prism | δ_min = 38.50° for a 60° BK7 prism at 632.8 nm; total internal reflection at 20° incidence |
| Uncertainty | Δf = 0.046 cm for do = 30.0 ± 0.1 cm, di = 15.0 ± 0.1 cm (analytic value) |
| Line fit | slope, intercept and standard errors of a hand-computed example |
| Every experiment | preset solves without error; ideal measurements return the accepted value |

The same quantities were checked in the running application: the numbers in the physics panel
against the equations, and the positions of spots, fringes and dark rings on the screen canvas
against the calculated values to within one pixel.
