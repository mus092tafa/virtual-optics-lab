# surface-polarization Specification

## Purpose
Defines how the polarisation of the incident ray changes the reflected and transmitted power at an interface, so that Brewster's angle can be observed and measured.

## Requirements

### Requirement: Reflected power follows the Fresnel coefficient of the chosen polarisation
The system SHALL use Rs for s-polarised light, Rp for p-polarised light and (Rs + Rp)/2 for unpolarised light as the reflected power fraction, and one minus that value as the transmitted fraction.

#### Scenario: Normal incidence from air on crown glass
- **WHEN** the ray meets crown glass (n = 1.5168) from air at 0°
- **THEN** the reflected power is 4.2 % for every polarisation setting

#### Scenario: s and p differ at oblique incidence
- **WHEN** the ray meets crown glass from air at 45°
- **THEN** the s reflectance is larger than the p reflectance and Rp = Rs²

### Requirement: The reflected p-polarised ray vanishes at Brewster's angle
At the angle of incidence θB = tan⁻¹(n₂/n₁) the system SHALL report zero reflected power for p-polarised light and SHALL NOT draw a reflected ray.

#### Scenario: Air to crown glass
- **WHEN** p-polarised light meets crown glass from air at 56.6°
- **THEN** the reflected power reads 0.0 % and the reflected and refracted directions are 90° apart

### Requirement: Brewster experiment recovers the refractive index
The notebook SHALL compute n₂ = n₁ tan θB from the recorded Brewster angle.

#### Scenario: Ideal measurement
- **WHEN** the student records θB = 56.6° with air as the first medium
- **THEN** the notebook reports n₂ within 0.01 of 1.5168
