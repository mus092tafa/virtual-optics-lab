# Spec Delta

## Purpose

Defines the far-field diffraction pattern of laser light behind a circular aperture and the experiment that measures the aperture diameter from it.

## ADDED Requirements

### Requirement: The screen shows the Airy pattern
For a circular aperture of diameter D lit by a laser of wavelength λ the system SHALL show the intensity I/I₀ = [2 J₁(x)/x]² with x = π D sin θ / λ, rotationally symmetric about the axis.

#### Scenario: First dark ring
- **WHEN** a 0.20 mm aperture is lit by the 632.8 nm laser and the screen is 110 cm behind it
- **THEN** the first dark ring has a radius of 4.25 mm

#### Scenario: First bright ring
- **WHEN** the intensity profile is read across the pattern
- **THEN** the first bright ring peaks at 1.75 % of the central intensity

### Requirement: Pattern size scales inversely with aperture diameter
The system SHALL widen the pattern in proportion to λ/D.

#### Scenario: Halving the diameter
- **WHEN** the aperture diameter is halved with everything else unchanged
- **THEN** the radius of the first dark ring doubles

### Requirement: Far-field validity is reported
The system SHALL report the Fresnel number (D/2)²/(λ L) and SHALL flag the pattern as invalid when it is 1 or more, and as approximate when it is between 0.1 and 1.

#### Scenario: Screen too close
- **WHEN** a 0.5 mm aperture is observed 5 cm behind it
- **THEN** an error notice states that the Fraunhofer pattern is not valid

### Requirement: White light at a pinhole is reported as not modelled
The system SHALL show a "not modelled" message when the tungsten lamp illuminates the circular aperture.

#### Scenario: Lamp and pinhole
- **WHEN** the tungsten lamp and the circular aperture are in the same path
- **THEN** the screen shows a "not modelled" message instead of a pattern

### Requirement: Aperture experiment recovers the diameter
The notebook SHALL compute D = 2.44 λ L / D_ring from the recorded distance and dark-ring diameter.

#### Scenario: Ideal measurement
- **WHEN** the student records L = 110 cm and a first dark ring of diameter 8.49 mm
- **THEN** the notebook reports D within 0.002 mm of 0.200 mm
