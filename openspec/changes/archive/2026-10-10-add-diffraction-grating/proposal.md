# Proposal

## Why

The diffraction grating is the most common undergraduate wave-optics experiment still missing from the lab. The bench already models single and double slits and the lamp spectrum, so the grating equation d sin θ = mλ can be added on the same footing and gives students a second, more precise way to measure a wavelength.

## What Changes

- New bench component: a transmission diffraction grating with selectable line density (100, 300, 600 lines/mm), adjustable clear aperture and line orientation.
- With the He-Ne laser, each diffraction order m appears on the screen as a deflected copy of the laser beam at y = L tan θₘ, where d sin θₘ = mλ. Relative order strength follows the amplitude-grating efficiency ηₘ = (a/d)² sinc²(π m a/d).
- With the tungsten lamp, each wavelength is sent to its own angle, so every order m ≠ 0 is a spectrum; its sharpness is limited by the grating aperture and the size of the source.
- New experiment "Diffraction Grating": measure λ from the position of an order, λ = d sin θ / m with tan θ = y / L.
- Configurations the model does not cover (a lens between the grating and the screen, an object in the same path) are reported as not modelled.

## Capabilities

### New Capabilities
- `diffraction-grating`: behaviour of a transmission grating on the optical bench for laser and white light, and the wavelength experiment built on it.

### Modified Capabilities

## Impact

- `src/physics/`: new `grating.ts`; `types.ts`, `constants.ts`, `units.ts`, `optics.ts` (solver branch, new `spots` screen light).
- `src/render/screenRenderer.ts`: rasterise `spots`.
- `src/state/`, `src/education/`, `src/components/`: component, preset, experiment, controls, glyph, report rows.
- `docs/PHYSICS.md`, README, unit tests.
