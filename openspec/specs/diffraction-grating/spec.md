# diffraction-grating Specification

## Purpose
Defines how a transmission diffraction grating on the optical bench deflects laser and white light, so that students can measure a wavelength from the grating equation.

## Requirements

### Requirement: Diffraction orders obey the grating equation
For monochromatic light at normal incidence the system SHALL place diffraction order m on the screen at y = L tan θₘ with d sin θₘ = mλ, where d is the grating period and L the grating-to-screen distance. Orders with |mλ/d| ≥ 1 SHALL NOT exist.

#### Scenario: First order of the red He-Ne line
- **WHEN** a 300 lines/mm grating is lit by the 632.8 nm laser and the screen is 25.0 cm behind it
- **THEN** the first-order spots are centred 48.3 mm on either side of the zeroth order

#### Scenario: Order that cannot propagate
- **WHEN** a 600 lines/mm grating is lit by the 632.8 nm laser
- **THEN** orders up to |m| = 2 are reported and no third order is shown

### Requirement: Order positions scale with wavelength and line density
The system SHALL move every order m ≠ 0 farther from the axis when the wavelength increases or the line density increases, and SHALL leave the zeroth order on the axis.

#### Scenario: Shorter wavelength
- **WHEN** the laser line is changed from 632.8 nm to 543.5 nm with the grating and screen unchanged
- **THEN** the first-order spots move closer to the axis in the ratio of tan θ for the two wavelengths

### Requirement: Order strength follows the amplitude-grating efficiency
The system SHALL give order m a share of the transmitted power proportional to sinc²(π m a/d), where a/d is the open fraction of one period.

#### Scenario: Relative strength of the first order
- **WHEN** the open fraction is 0.3
- **THEN** the first order carries 0.737 of the power of the zeroth order

### Requirement: White light is dispersed into spectra
For the tungsten lamp the system SHALL show a white zeroth order and, for each order m ≠ 0, a spectrum with longer wavelengths farther from the axis. The width over which each wavelength is spread SHALL follow from the grating aperture and the angular size of the source.

#### Scenario: Colour order in the first-order spectrum
- **WHEN** the tungsten lamp illuminates the grating
- **THEN** in the first order red light lands farther from the axis than blue light

#### Scenario: Narrower grating aperture
- **WHEN** the grating aperture is reduced
- **THEN** the spectrum becomes sharper and dimmer

### Requirement: Unmodelled grating configurations are reported
The system SHALL report the configuration as not modelled, and show no pattern, when a lens lies between the grating and the screen or when an object is in the same light path as the grating.

#### Scenario: Lens behind the grating
- **WHEN** a lens is placed between the grating and the screen
- **THEN** the screen shows a "not modelled" message instead of a pattern

### Requirement: Grating experiment recovers the wavelength
The lab notebook SHALL compute λ = d sin(tan⁻¹(y/L)) / m from a recorded order position y, distance L and order m.

#### Scenario: Ideal measurement
- **WHEN** the student records L = 25.0 cm, y = 48.3 mm and m = 1 for a 300 lines/mm grating
- **THEN** the notebook reports a wavelength within 0.5 nm of 632.8 nm
