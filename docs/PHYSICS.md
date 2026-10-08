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
| Object and slit together | not modelled: the screen says so instead of showing a guess |
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
  dispersion is ignored even though the ray is drawn as a red laser.

## 3. Thin lens imaging — `lenses.ts`, `rayTransfer.ts`

- Thin lens equation 1/f = 1/do + 1/di, with real-is-positive signs: do > 0 for a real object,
  di > 0 for a real image, f > 0 for a converging lens.
- Magnification m = hi/ho = −di/do. m < 0: inverted. |m| > 1: magnified.
- Object in the focal plane: image at infinity. Object inside f: virtual, upright, magnified image,
  which cannot be caught on the screen.
- Several lenses: the image of one lens is the object of the next. The same result is obtained from
  the product of ray-transfer (ABCD) matrices, where the image plane is where B = 0 and m = A.
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

## 10. Rendering

`src/render/screenRenderer.ts` converts the solver's result to pixels: for each screen position it
takes the calculated irradiance, applies the exposure gain and a display gamma of 2.2. Patterns are
sampled three times per pixel and averaged in linear light so fine fringes do not alias.

## 11. Known limitations

- Paraxial optics throughout: no spherical or chromatic aberration.
- No vignetting of off-axis object points; no diffraction limit of the lens.
- Laser speckle and the laser's coherence length are not modelled.
- One source, one object, one slit component and one screen can be mounted at a time; up to three
  lenses.
- An object and a slit in the same light path are not modelled.

## 12. Validation

`npm test` runs 82 tests of the physics layer, including:

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
