# Design

## Context

Slits are solved with a Fraunhofer / Fresnel pattern sampled along one screen axis. A grating at bench distances breaks two assumptions of that code: the diffraction angles are far from paraxial (11° to 22° in first order), and the illuminated width of the grating (about 1 mm of laser beam) puts the screen in the near field of the whole aperture, so the N-slit Fraunhofer formula does not apply.

## Goals / Non-Goals

**Goals:**
- Order positions exact for any angle (no small-angle approximation).
- Spot size on the screen derived from Gaussian beam propagation, not from an N-slit far-field formula used outside its range.

**Non-Goals:**
- Oblique incidence, blazed or phase gratings, lenses after the grating, a slit and grating together (spectrometer).

## Decisions

- **Laser: each order is a deflected Gaussian beam.** When the beam covers many lines the field behind the grating is a sum of copies of the incident beam with transverse wavevector shifted by 2πm/d. In the dispersion plane the copy has beam parameter q′ = q cos²θₘ and travels L / cos θₘ to the screen; its footprint on the flat screen is w / cos θₘ. For a waist at the grating this gives footprint² = w² + (λL / (π w cos³θₘ))². Alternative considered: N-slit Fraunhofer formula with N = 2w/d. Rejected because the Fresnel number of the illuminated aperture is above 1 at bench distances.
- **New `spots` screen light.** A list of elliptical Gaussian spots, each with its own centre, two radii and level. The existing `fringes` type has a single transverse profile shared by the whole pattern, which is wrong for orders that travel different distances.
- **Lamp: geometric projection of the aperture per wavelength and order.** A ray through aperture point ξ from source point s arrives with slope α = ξ/R − s/B (R, B from the source-to-grating ray matrix) and leaves with sin θ = sin α + mλ/d. Differentiating the landing point gives a patch that is the convolution of two boxes of widths W·|1 + (L/R) sec³θ| and s·(L/|B|) sec³θ, evaluated as a trapezoid. The result reuses the `fringes` screen light with a flat band.
- **Fixed open fraction a/d = 0.3.** No order up to m = 3 vanishes, so students can measure higher orders. Scalar theory is only approximate for the efficiencies at 600 lines/mm; the angles are exact regardless.
- **Lenses after the grating are refused.** The paraxial ray matrices used for lenses are not valid at these angles.

## Risks / Trade-offs

- [Efficiencies from scalar theory are approximate for fine gratings] → stated in the model assumptions; positions do not depend on them.
- [Laser beam wider than the grating aperture is not truncated] → the solver warns when the aperture is under three beam radii.
