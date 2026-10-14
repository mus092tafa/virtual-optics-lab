# Spec Delta

## Purpose

Defines how the focus of the laboratory's eye depends on the wavelength of the light, which light the chart can be lit with, and how the image of a white chart is coloured and blurred by the eye's chromatic aberration.

## ADDED Requirements

### Requirement: The indices of the eye depend on wavelength
The system SHALL scale the refractivity n − 1 of every medium of the eye with wavelength as the chromatic eye does, n(λ) = 1.320535 + 0.004685/(λ − 0.214102 µm), keeping the schematic eye's indices at 589 nm, and SHALL compute powers, refractive error and focus at the wavelength of the light.

#### Scenario: Blue is focused in front of red
- **WHEN** the relaxed normal eye looks at a distant object in light of 486 nm, 589 nm and 656 nm
- **THEN** the refractive error shown is −0.61 D, 0.00 D and +0.24 D
- **AND** the focus lies 0.22 mm in front of the retina, on it, and 0.09 mm behind it

#### Scenario: The reference wavelength
- **WHEN** the light is 589 nm
- **THEN** every measurement equals that of the eye without chromatic aberration

### Requirement: Chromatic aberration is a switch
The system SHALL let the dependence of the indices on wavelength be switched on and off. While it is off the eye SHALL have its 589 nm indices in every light, so that the colour of the light changes the colour of the image and nothing else.

#### Scenario: Switched off
- **WHEN** chromatic aberration is off and the light is set to 450 nm
- **THEN** every measurement equals that at 589 nm and the image is shown in the colour of 450 nm

#### Scenario: Fixed for an unknown eye
- **WHEN** the eye's unknowns are concealed or the bench belongs to an exam question
- **THEN** the switch cannot be changed

### Requirement: The chart is lit with one wavelength or with white light
The system SHALL let the student light the chart with a single wavelength between 400 and 700 nm or with white light, and SHALL state on screen which white is used.

#### Scenario: Monochromatic light
- **WHEN** the light is set to 486 nm
- **THEN** the image is shown in the colour of that wavelength, and the eye accommodates for 486 nm

#### Scenario: White light
- **WHEN** the light is white
- **THEN** the eye accommodates for 589 nm and the measurements shown are those at 589 nm

### Requirement: In white light every wavelength has its own blur
In white light the system SHALL form the image as the sum over the visible spectrum, each wavelength blurred by the patch that its own focus gives, and SHALL show the resulting colours.

#### Scenario: Coloured edges
- **WHEN** a normal eye with a 4 mm pupil, in focus at 589 nm, looks at the letter chart in white light
- **THEN** light of 450 nm is spread over a patch of 70 µm on the retina while light of 589 nm is in focus, and the edges of the letters are coloured

#### Scenario: A smaller pupil
- **WHEN** the pupil is reduced
- **THEN** the coloured edges shrink in proportion to the pupil diameter

### Requirement: The chromatic difference of refraction is reported
The system SHALL report the chromatic difference of refraction of the eye between 486 nm and 656 nm and SHALL withhold it, with the refractive error at the chosen wavelength, in experiment mode until the theory is revealed.

#### Scenario: The schematic eye
- **WHEN** the theory is visible
- **THEN** the chromatic difference of refraction shown is 0.85 D

### Requirement: The chromatic experiment analyses the student's readings
The system SHALL offer the experiment "Chromatic aberration of the eye" with a guide, the model's assumptions and limits, and a notebook that takes the glasses found sharp in blue and in red light and gives the chromatic difference of refraction.

#### Scenario: Two colours
- **WHEN** a student records −0.50 D for 486 nm and +0.25 D for 656 nm at a vertex distance of 12 mm
- **THEN** the notebook gives a chromatic difference of refraction of 0.75 D and, once the theory is revealed, compares it with 0.85 D
