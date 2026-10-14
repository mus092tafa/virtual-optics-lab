# Spec Delta

## ADDED Requirements

### Requirement: Glasses can carry a cylinder
The system SHALL let the student add a cylinder, in steps of 0.25 D, and its axis from 0° to 180° to the glasses. The lens SHALL then have the power of the sphere along the axis and the power of sphere plus cylinder in the meridian at right angles to it, and SHALL be treated as thin at the vertex distance.

#### Scenario: A plano-cylinder
- **WHEN** the glasses are 0.00 / −2.00 × 180 and a distant object is viewed
- **THEN** the light leaving the lens is parallel in the horizontal meridian and has the vergence −2.00 D in the vertical meridian

#### Scenario: No cylinder
- **WHEN** the cylinder is zero
- **THEN** the glasses behave as the spherical lens, whatever the axis

### Requirement: The correcting lens of an astigmatic eye is sphero-cylindrical
The system SHALL give the lens that fully corrects an astigmatic eye as a sphere, a negative cylinder and an axis, each principal meridian being corrected with Fs = K/(1 + dK).

#### Scenario: Simple myopic astigmatism
- **WHEN** an eye of refraction 0.00 / −2.00 × 180 wears glasses at 12 mm
- **THEN** the correcting lens reported is 0.00 / −2.05 × 180
- **AND** with that lens the blur of a distant object is zero

#### Scenario: The axis must be right
- **WHEN** that eye wears 0.00 / −2.05 with the axis at 170° instead of 180°
- **THEN** the blur of a distant object is a patch of 26 µm for a 4 mm pupil, not zero

#### Scenario: The spherical equivalent
- **WHEN** that eye wears a sphere of −1.00 D with no cylinder
- **THEN** the blur of a distant object for a 4 mm pupil is nearly circular, about 75 µm across, half the length of the line without glasses
