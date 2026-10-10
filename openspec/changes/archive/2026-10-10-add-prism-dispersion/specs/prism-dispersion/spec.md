# Spec Delta

## Purpose

Defines how a ray of a given wavelength is refracted through a glass prism whose index depends on wavelength, so that dispersion can be observed and a refractive index measured by minimum deviation.

## ADDED Requirements

### Requirement: Glass indices depend on wavelength
The system SHALL compute the refractive index of each prism glass from its Sellmeier equation at the wavelength of the ray.

#### Scenario: BK7 at the helium d line
- **WHEN** the index of BK7 is evaluated at 587.6 nm
- **THEN** it is 1.5168 to four decimal places

#### Scenario: Normal dispersion
- **WHEN** the index of any prism glass is evaluated at 450 nm and at 650 nm
- **THEN** the index at 450 nm is the larger

### Requirement: The ray is refracted at both faces by Snell's law
For apex angle A and angle of incidence θ₁ the system SHALL compute sin θ₁ = n sin θ₁′, θ₂′ = A − θ₁′, n sin θ₂′ = sin θ₂ and the deviation δ = θ₁ + θ₂ − A.

#### Scenario: Symmetric passage
- **WHEN** a 632.8 nm ray passes symmetrically through a 60° BK7 prism
- **THEN** the angle of incidence is 49.25° and the deviation is 38.5°

### Requirement: Deviation has a minimum at symmetric passage
The system SHALL give the smallest deviation when the angles of incidence and emergence are equal, with n = sin((A + δmin)/2) / sin(A/2).

#### Scenario: Rotating the prism through the minimum
- **WHEN** the angle of incidence is varied on either side of 49.25° for a 60° BK7 prism at 632.8 nm
- **THEN** the deviation is larger than 38.5° on both sides

### Requirement: White light is spread into a spectrum
For white light the system SHALL trace each wavelength with its own index, so that shorter wavelengths are deviated more.

#### Scenario: Blue and red
- **WHEN** white light passes through the prism
- **THEN** the 450 nm ray is deviated more than the 650 nm ray

### Requirement: Rays that cannot emerge are reported
The system SHALL report total internal reflection at the second face, or a ray that does not reach the second face, and SHALL NOT draw an emergent ray in those cases.

#### Scenario: Small angle of incidence
- **WHEN** a ray meets a 60° BK7 prism at 20° incidence
- **THEN** the read-out states total internal reflection at the second face and no emergent ray is drawn

### Requirement: Prism experiment recovers the refractive index
The notebook SHALL compute n = sin((A + δmin)/2) / sin(A/2) from the recorded minimum deviation and the apex angle.

#### Scenario: Ideal measurement
- **WHEN** the student records δmin = 38.5° for a 60° prism
- **THEN** the notebook reports n within 0.001 of 1.5151
