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

## 16. The eye — `eye.ts`

A schematic eye, traced paraxially from the cornea to the retina. Distances are measured from the
corneal vertex; vergences are in dioptres at the cornea, negative for light diverging from a real
object.

- **Model: the Gullstrand–Emsley eye** (H. H. Emsley, *Visual Optics*, 1936). One corneal surface of
  radius 7.8 mm; aqueous and vitreous of index 4/3; a lens of index 1.416.

  | | Chamber depth | Front radius | Back radius | Thickness |
  | --- | --- | --- | --- | --- |
  | Relaxed | 3.6 mm | +10 mm | −6 mm | 3.6 mm |
  | Accommodated (8.6 D) | 3.2 mm | +5 mm | −5 mm | 4.0 mm |

- **Surface power** P = (n′ − n)/r. Cornea: (4/3 − 1)/7.8 mm = 42.74 D. Lens surfaces 8.27 D and
  13.78 D; thick lens P₁ + P₂ − (t/n)P₁P₂ = 21.75 D. The whole eye is the product of the surface
  matrices [1, 0; −P/n′, n/n′] and translations; its equivalent power is −n′C = 60.48 D and it
  focuses a distant object 23.90 mm behind the cornea. That length is the *normal axial length*.
  The same image position follows from the vergence equation L′ = L + P at each surface with
  L₂ = L₁/(1 − (d/n)L₁) between them; the unit tests check the two against each other.
- **Curvature is the input.** The student sets the corneal radius (7.0–8.6 mm) and the axial length
  (21–27 mm). Powers are results and cannot be entered.
- **Refractive error** K is the vergence at the cornea that the relaxed eye focuses on its retina:
  0 for the normal eye, negative in myopia (far point 1/|K| in front of the eye), positive in
  hyperopia (far point behind the eye). Near the normal eye 1 mm of axial length is about 2.6 D:
  25.04 mm gives −3 D, 22.85 mm gives +3 D. A cornea of 7.29 mm on the normal length also gives
  −3 D.
- **Accommodation.** The lens has one state a: the curvatures 1/r of both surfaces, the thickness
  and the chamber depth change linearly from the relaxed (a = 0) to the accommodated (a = 1) eye
  of the table, and continue the same way beyond a = 1. The accommodation in dioptres is
  K − L(a), where L(a) is the vergence focused on the retina in state a. The state for a wanted
  accommodation is found by bisection.
- **Automatic accommodation.** The eye takes the accommodation K − L that images the object
  (vergence L at the cornea) on the retina, limited to the range from 0 to the largest
  accommodation of its age. Beyond either limit the image is out of focus. The student can hold
  the lens at a chosen accommodation instead, within the same range.
- **Age.** Largest accommodation A = 18.5 − 0.30 × age (dioptres), Hofstetter's average of
  Donders' and Duane's measurements, not below zero. Near point at 1/(A − K) in front of the
  cornea. Age changes nothing else: the cornea and the axial length are separate controls.
- **Focus position.** The focus of the object's light lies where the ray from the axial object
  point crosses the axis; its distance from the retina is reported, positive behind the retina.
- **Blur.** The aperture stop is the iris at the front of the lens, with the diameter the student
  sets (2–8 mm). The ray from the axial object point through the edge of the pupil reaches the
  retina at the height y; the blur disc has the diameter 2|y|. It is proportional to the pupil and
  to the defocus and zero in focus. The chart is drawn at its retinal size, convolved with a
  uniform disc of that diameter (as for the screen of the optical bench, §3).
- **Image size.** The chief ray (through the centre of the pupil) of the top of a letter gives its
  height on the retina. For a distant object subtending α it is −α/F: 24 µm for a 5′ letter. The
  image on the retina is inverted; the panel shows it as it is seen.
- **Brightness.** The illuminance of the retinal image is proportional to the area of the pupil.
- **Sharpness grade.** The blur-disc diameter over the stroke width of the letters on the retina
  (a letter is five strokes high): up to ¼ *sharp*, up to 1 *slightly blurred*, up to 3 *blurred*,
  above that *unreadable*. This is a geometric comparison, not a prediction of visual acuity.

**Assumptions and range of validity.** Paraxial optics with spherical, centred surfaces and
homogeneous media, at one wavelength. The model describes the on-axis image. The blur shown is
reliable from about 0.25 D of defocus upward; closer to focus the real eye is limited by
aberrations and diffraction, which are not modelled, so "sharp" here means "in geometric focus".
The lens beyond a = 1 is an extrapolation of the schematic eye, not a measured young lens; the
accommodation in dioptres, which is what the experiments measure, is exact by construction. The
age relation is a population average with a spread of several dioptres between people, and it
reaches zero at 62 years, although real eyes keep about 1 D of apparent accommodation from their
depth of focus.

**Switched off unless asked for:** astigmatism, chromatic aberration and spherical aberration.
With one corneal radius, the eye's 589 nm indices in every light and paraxial rays, the eye is
exactly the one described above. The three subsections below describe what each switch adds.

**Not modelled:** aberrations of objects off the axis (coma, oblique astigmatism), irregular
astigmatism and astigmatism of the lens, diffraction at the pupil, the gradient index of the lens,
the Stiles–Crawford effect, the change of the pupil with accommodation and age, and everything the
retina and the brain do with the image. The ciliary muscle and the zonule in the drawing are
anatomy; they carry no calculation.

### Astigmatism — `astigmatism.ts`

- **A toric cornea.** The cornea has a radius r₁ in one meridian and r₂ in the meridian at right
  angles to it; each has the power (n′ − 1)/r. The second radius is an input like the first
  (7.0–8.6 mm), with the direction θ of the first meridian.
- **Angles** are those seen by an examiner facing the eye: counter-clockwise from the horizontal,
  0° to 180°, x to the examiner's right and y up. This is the notation of a prescription.
- **Rays in two meridians.** A paraxial ray has a two-component height **y** and slope **u**. A
  curvature or a power is a symmetric 2 × 2 matrix, and the ray-transfer matrix [A B; C D] of §3 is
  built of 2 × 2 blocks:
  - gap d: **y′** = **y** + d **u**;
  - surface from n into n′ with curvature matrix **C** = R(θ) diag(1/r₁, 1/r₂) R(θ)ᵀ:
    **u′** = (n/n′) **u** − ((n′ − n)/n′) **C** **y**;
  - thin lens of power matrix **F**: **u′** = **u** − **F** **y**.

  This is exact in the paraxial approximation for any orientation of the elements, obliquely
  crossed cylinders included. For a symmetric system every block is a multiple of the unit matrix
  and the scalar matrices of `rayTransfer.ts` are recovered (tested).
- **The beam of an object point.** Light of vergence L at the first element enters at **p** with
  the slope −L **p**. Naming a ray by the point **s** where it passes the pupil, its height at a
  plane x behind the lens is **W**(x) **s**, with **W**(x) = **P** + (x − x_b) **Q** from the block
  matrices (x_b the back of the lens).
- **Focal lines.** The beam collapses to a line where det **W**(x) = 0, a quadratic in x: two
  planes, one for each principal meridian (the conoid of Sturm). The line at each plane lies along
  the direction in which **W** still spreads the light. A cornea of 7.80 mm horizontally and
  7.45 mm vertically (42.74 D and 44.74 D) on the normal length focuses the horizontal meridian on
  the retina and the vertical one 0.71 mm in front of it: a vertical line on the retina, a
  horizontal line in front.
- **Blur.** On the retina the pupil circle of radius R is mapped by **W** to an ellipse whose
  semi-axes are R times the singular values of **W**. For that eye, a distant object and a 4 mm
  pupil: a vertical line 150 µm long. Held relaxed with the object at 1 m, the circle of least
  confusion lies on the retina: 75 µm.
- **Refraction.** The refractive error is the matrix **K** = R(θ) diag(K₁, K₂) R(θ)ᵀ of the two
  meridians' errors. It is written as sphere / cylinder × axis with a negative cylinder: the sphere
  is the larger principal value, the cylinder the difference, the axis the direction of the
  sphere's meridian. That eye is 0.00 / −2.00 × 180. The scalar K reported elsewhere is the mean of
  the two (the spherical equivalent).
- **Accommodation.** The lens is symmetric, so accommodation moves both focal lines together. Left
  to itself the eye accommodates for the mean vergence of the two meridians, which puts the circle
  of least confusion on the retina to within a percent. This is an assumption about the eye's
  control, not a result.
- **Image scale.** The chief ray (through the centre of the pupil) maps the direction of an object
  point to its place on the retina with a 2 × 2 matrix; the chart is drawn with it, so the slight
  stretch of the image along one meridian (also by a cylinder lens) is in the picture. The letter
  height quoted is the geometric mean of the two scales.
- **Assumptions and limits.** Paraxial; a toric cornea and a symmetric lens, centred on one axis;
  regular astigmatism only.

### Chromatic aberration of the eye — `ocularDispersion.ts`

- **Dispersion.** The index of the *chromatic eye* (L. N. Thibos, M. Ye, X. Zhang, A. Bradley,
  Applied Optics 31, 3594, 1992) is n_c(λ) = 1.320535 + 0.004685/(λ − 0.214102), λ in micrometres;
  n_c(589 nm) = 1.3330. Every medium of the schematic eye is given this dispersion: its
  refractivity at 589 nm, where the schematic eye's indices are taken to hold, is scaled,

  n(λ) − 1 = (n₅₈₉ − 1) · (n_c(λ) − 1)/(n_c(589 nm) − 1).

  At 486 nm the humour has n = 1.3381 and the lens 1.4219; at 656 nm 1.3314 and 1.4136.
- **Result.** The eye is traced at the wavelength of the light. The relaxed normal eye has
  K = −0.60 D (−0.605) at 486 nm, 0 at 589 nm and +0.24 D at 656 nm; its focus lies 0.22 mm in front of the
  retina, on it, and 0.09 mm behind it. The chromatic difference of refraction between the two
  lines is 0.85 D.
- **Against measurement.** The chromatic eye was fitted to measured eyes: its chromatic difference
  of refraction is Rx(λ) = 1.68524 − 0.63346/(λ − 0.21410) dioptres, 0.90 D between those lines.
  The three-surface eye here gives 5% less, because its separations do not scale with its powers;
  over 400–700 nm it stays within 0.1 D of that curve (tested).
- **Light on the chart.** One wavelength between 400 and 700 nm, or white light: a black body of
  6500 K divided into twelve bands, each with its linear-sRGB weight from the colour-matching
  functions of §8. The weights are scaled channel by channel so that the bands add up to the
  display's white: the white of the chart is shown as white.
- **White light.** The eye is taken to accommodate for 589 nm. Every band then has its own patch on
  the retina (70 µm across at 450 nm with a 4 mm pupil), and the image is the sum of the chart
  blurred band by band: coloured edges. The measurements quoted in white light are those at 589 nm.
- **Switch.** Without "chromatic aberration" the eye keeps its 589 nm indices in every light: the
  schematic eye as published. Monochromatic light then only colours the image.
- **Assumptions and limits.** Homogeneous media sharing one dispersion curve; 400–700 nm. The
  difference of image size between colours is neglected: with the pupil 3.6 mm behind the cornea it
  is below 1% of the distance from the axis. The spectacle lens has no chromatic aberration (it
  would add F/V, 0.05 D for a 3 D lens). The eye's choice of 589 nm in white light is an
  assumption; real eyes focus a wavelength between about 550 and 590 nm.

### Spherical aberration of the eye — `eyeRays.ts`

- **Surfaces** are conicoids of revolution: with s measured from the vertex plane,
  c (y² + (1 + Q) s²) − 2s = 0, that is s = c y²/(1 + √(1 − (1 + Q) c² y²)). c = 1/r is the vertex
  curvature, so the paraxial eye does not depend on Q. Q = 0 is a sphere, −1 < Q < 0 an ellipsoid
  that flattens towards its edge, Q = −1 a paraboloid.
- **Real rays.** A meridional ray is followed exactly: its intersection with the surface is the
  smaller root of a quadratic, and it is refracted by Snell's law, n sin i = n′ sin i′, in vector
  form **d′** = μ **d** + (μ cos i − √(1 − μ²(1 − cos² i))) **n**, μ = n/n′. A ray that misses a
  surface, would pass beyond the edge of the lens or is totally reflected is blocked; the share of
  blocked light is reported.
- **Checks.** A single sphere of 7.8 mm into n′ = 4/3: the ray at 3 mm crosses the axis at
  29.86 mm, where the triangle with the centre of curvature puts it (the paraxial focus is at
  31.20 mm). An ellipsoid with Q = −(n/n′)² = −0.5625 is free of spherical aberration for a distant
  point: every ray crosses at 31.20 mm.
- **Zone refraction.** K(h) is the vergence at the cornea of the object point whose ray through the
  pupil at the height h meets the axis at the retina. The longitudinal spherical aberration is
  K(0) − K(h) for the ray through the edge of the pupil, positive when the edge rays are focused in
  front. Relaxed normal eye with spherical surfaces, 4 mm pupil: 2.1 D, the edge rays crossing
  0.73 mm in front of the retina.
- **Shapes.** *Spheres*: the schematic eye as published. Its spherical aberration is several times
  that of a real eye. *Average eye*: cornea Q = −0.26 (P. M. Kiely, G. Smith, L. G. Carney, Optica
  Acta 29, 1027, 1982) and one Q for both lens surfaces, solved so that a distant ray entering 3 mm
  from the axis has 1.0 D of aberration. That is the mean of measured eyes: Z₄⁰ = 0.138 µm over a
  5.7 mm pupil (J. Porter et al., J. Opt. Soc. Am. A 18, 1793, 2001) gives W₀₄₀ = 6√5 Z₄⁰ and
  4 W₀₄₀ h²/R⁴ = 1.0 D at h = 3 mm. The solve gives Q = −2.20. This Q stands in for the gradient
  index of the real lens; it is a fit to the total, not a measured lens shape.
- **Light on the retina.** The pupil is divided into 24 zones of equal area. The rays that bound
  them land on the retina at radii ρ₀ … ρ₂₄; each zone's light fills the ring between two of them.
  The picture is the chart convolved with those rings.
- **Equivalent blur diameter.** For any light of an object point, d = 2√2 · r_rms, with r_rms the
  root-mean-square distance from the axis (weighted by luminance in white light). For a uniform
  disc this is its diameter, for an ellipse √(2(a² + b²)) with semi-axes a and b, so a 150 µm line
  counts as 106 µm. The sharpness grade uses it for every eye. With spherical surfaces and a 6 mm
  pupil it is 0.40 mm although the eye is in paraxial focus.
- **Best focus.** The eye still accommodates for its paraxial focus. The spherical lens that makes
  d smallest moves with the pupil: for the average eye −0.08 D at 2 mm and −1.60 D at 8 mm; for
  spherical surfaces −0.33 D and −7.91 D. But with a wide pupil "the sharpest lens" is not one
  lens: the lens of smallest d, the lens of highest contrast for fine bars and the lens a picture
  looks best with differ by a dioptre or more, because the beam has no single focus.
- **Ring stop.** A stop in the pupil can cover its middle up to a fraction ε of its radius R. Real
  rays are then traced through the open ring only, the image is dimmer by 1 − ε², and the ring is
  named by its root-mean-square radius h = R √((1 + ε²)/2). A narrow ring has one focus, so one
  lens makes its image sharp: the lens that corrects K(h). This is how the experiment measures the
  aberration, zone by zone: K(centre) − K(h), with the 2 mm open pupil standing for the centre.
  Through 2.70–3.00 mm (ε = 0.9 at 6 mm, h = 2.85 mm): 4.89 D with spherical surfaces, 1.14 D for
  the average eye. Near the axis the aberration is a h² with a = 0.122 D/mm² for the average eye.
- **Assumptions and limits.** Homogeneous media; an object point on the axis; pupil 2–8 mm;
  −1 ≤ Q ≤ 0.5 for the cornea and −6 ≤ Q ≤ 1 for the lens. The lens asphericity is held fixed while
  the eye accommodates. The glasses are an ideal thin lens. Real rays are traced only in an eye
  with one corneal radius and glasses without a cylinder: a meridional ray needs an eye that is the
  same in every plane through its axis. Otherwise the laboratory says so and traces paraxially.
  Geometric optics: within about 4 µm of a point (the Airy radius 1.22 λ f/D at 4 mm) the real
  image is limited by diffraction, which is not modelled.

### Views of the eye

- **Side and top view** are the vertical and the horizontal section. Each draws the cornea with
  its curvature in that plane, c₁ cos²δ + c₂ sin²δ at the angle δ from the first meridian, with its
  asphericity, and the rays that pass the edge of the pupil in that plane. When a principal
  meridian of the system lies in the plane the rays stay in it; otherwise they leave it, the
  drawing shows their projection and says so.
- **Front view**: the pupil at its diameter, the principal meridians of the cornea with their
  radii, and the axis of the cylinder, on the examiner's scale of degrees.
- **Beam cross-sections**: the outline of the light of one object point at planes from in front of
  the first focus to behind the last, the retina among them, seen facing the eye: the ellipse
  **W**(x) of paraxial light, or the rings of the real rays. They are exact for any orientation.
- **The image panel** shows what the eye sees. That is the examiner's picture mirrored left to
  right; the numbers on the fan chart are meridians in the examiner's count, so the sharp line of
  the fan names the direction of the focal line on the retina.

## 17. Spectacles — `spectacles.ts`

- The glasses are a thin lens of power Fs in air, at the vertex distance d in front of the cornea
  (12 mm unless changed; 0 is a contact lens).
- Light of vergence L at the lens leaves it with L′ = L + Fs and reaches the cornea with
  L′/(1 − dL′). The eye then accommodates to that vergence as in §16.
- The lens that corrects K images a distant object at the eye's far point: Fs = K/(1 + dK). For
  K = −3 D at 12 mm, Fs = −3.11 D; for +3 D, +2.90 D; for −6 D, −6.47 D. Conversely an eye for
  which Fs makes a distant chart sharp has K = Fs/(1 − dFs).
- Reading glasses are a positive lens: an object 40 cm in front of +1.50 D reaches the cornea
  with −0.99 D, so a normal eye needs 0.99 D of accommodation instead of 2.43 D.
- The lens is part of the same ray-transfer matrix as the eye, so the change of the retinal image
  size (spectacle magnification) follows from the trace: about −4% for the −3 D correction.
- While the glasses are on, the laboratory also solves the bare eye for the same object and shows
  both.
- **Cylinder.** The glasses can carry a cylinder C with its axis at the angle a: the power is S
  along the axis and S + C in the meridian at right angles to it, the matrix
  **F** = S·**1** + C·[sin²a, −sin a cos a; −sin a cos a, cos²a]. Light of vergence L leaves the
  lens with **L′** = L·**1** + **F** and reaches the cornea with **L′**(**1** − d**L′**)⁻¹.
- The lens that corrects a refraction **K** is **F** = **K**(**1** + d**K**)⁻¹: Fs = K/(1 + dK) in
  each principal meridian, with the eye's axis. 0.00 / −2.00 × 180 is corrected by
  0.00 / −2.05 × 180 at 12 mm. With the axis 10° off, a 4 mm pupil is left with a patch of 26 µm;
  with the spherical equivalent alone (−1.00 D) with a round patch of 75 µm, half the line.
- Assumptions: a thin lens, on the axis of the eye, in paraxial light. Lens thickness and shape,
  prismatic effects off the axis and the chromatic aberration of the lens are not modelled.

## 18. Lab notebook — `src/education/`

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

## 19. Rendering

`src/render/screenRenderer.ts` converts the solver's result to pixels: for each screen position it
takes the calculated irradiance, applies the exposure gain and a display gamma of 2.2. Patterns are
sampled three times per pixel and averaged in linear light so fine fringes do not alias.

`src/render/eyeImage.ts` draws the chart at its retinal size and convolves it with the light of one
object point that the eye solver returned (`src/render/pointSpread.ts`). One uniform ellipse is
convolved row by row on prefix sums, as the blur disc of §3 is. Anything else (several colours,
rings) is rasterised into one kernel per colour channel by covered area and convolved by a
radix-2 Fourier transform on a zero-margined grid of at most 512 points a side. Both conserve the
light, and agree with each other on a disc (tested). A patch smaller than a pixel is drawn as a
point, and a line or ring never thinner than a pixel.

## 20. Known limitations

- Paraxial optics on the bench: no spherical or chromatic aberration of its lenses and mirrors.
  The eye has both, and astigmatism, as options (§16).
- In the eye: real rays not together with astigmatism; no aberrations off the axis; no diffraction.
- No vignetting of off-axis object points; no diffraction limit of the lens.
- Laser speckle and the laser's coherence length are not modelled.
- One source, one object, one diffracting element (slit, double slit, grating or pinhole), one
  mirror and one screen can be mounted at a time; up to three lenses and three polarisers.
- An object and a diffracting element in the same light path are not modelled.
- No lens behind a grating, no lens or aperture in front of a mirror, no white light at a pinhole.
- Polarisers are ideal; the reflection and refraction experiments keep fixed 589 nm indices.

## 21. Validation

`npm test` runs 350 tests of the physics layer, the notebook analysis and every experiment preset,
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
| Schematic eye | 42.74 D + 21.75 D → 60.48 D, focus at 23.90 mm; 8.6 D accommodated; matrix result equals the vergence equation surface by surface |
| Accommodation and age | 4.0 D in use at 25 cm; near point 8, 20, 50 cm at 20, 45, 55 years; the relaxed eye does not change with age |
| Refractive error | ±3 D at 25.04 and 22.85 mm axial length; focus 1.14 mm in front of, 1.05 mm behind the retina |
| Blur on the retina | 295 µm at 4 D of defocus with a 4 mm pupil; proportional to the pupil; zero in focus |
| Spectacles | −3.11, +2.90 and −6.47 D correct −3, +3 and −6 D at 12 mm; +1.50 D at 40 cm leaves 0.99 D to accommodate |
| Astigmatic eye | 7.80 / 7.45 mm cornea: 0.00 / −2.00 × 180; vertical line of 150 µm on the retina, horizontal line 0.71 mm in front; 75 µm circle at 1 m; equal radii give the symmetric eye |
| Cylinder glasses | 0.00 / −2.05 × 180 at 12 mm leaves no blur; 26 µm with the axis 10° off; each meridian obeys K/(1 + dK) |
| Chromatic eye | n_c(589 nm) = 1.3330; K = −0.60 D at 486 nm, +0.24 D at 656 nm; within 10% of the measured 0.90 D; nothing changes at 589 nm |
| Real rays | sphere: 29.86 mm at 3 mm, equal to the closed form; ellipsoid Q = −0.5625: 31.20 mm at every height; paraxial limit |
| Spherical aberration | 2.1 D and −0.73 mm at a 4 mm pupil; 0.40 mm of blur at 6 mm; lens Q solved for 1.0 D at 3 mm; a ring stop is brought to focus by the lens of its zone; aberration ∝ h² |
| Point spread | ellipse blur equals the disc blur for a circle; Fourier convolution agrees with it and conserves light; a focal line keeps its own fan line sharp |
| Prism | δ_min = 38.50° for a 60° BK7 prism at 632.8 nm; total internal reflection at 20° incidence |
| Uncertainty | Δf = 0.046 cm for do = 30.0 ± 0.1 cm, di = 15.0 ± 0.1 cm (analytic value) |
| Line fit | slope, intercept and standard errors of a hand-computed example |
| Every experiment | preset solves without error; ideal measurements return the accepted value |

The same quantities were checked in the running application: the numbers in the physics panel
against the equations, and the positions of spots, fringes and dark rings on the screen canvas
against the calculated values to within one pixel.
