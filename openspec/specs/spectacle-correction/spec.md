# spectacle-correction Specification

## Purpose
Defines how a spectacle lens in front of the eye changes the light reaching the cornea, which power corrects a given refractive error, and how the eye's image with and without the glasses is compared.

## Requirements

### Requirement: Glasses change the vergence reaching the cornea
The system SHALL treat the glasses as a thin lens of power Fs at a vertex distance d in front of the cornea: light of vergence L at the lens leaves it with L′ = L + Fs and reaches the cornea with L′/(1 − d L′). The student SHALL be able to put the glasses on, take them off and set the power in steps of 0.25 D.

#### Scenario: A reading lens at 40 cm
- **WHEN** an object is 40 cm in front of +1.50 D glasses worn 12 mm from the cornea
- **THEN** the vergence at the cornea is −0.99 D, so a normal eye needs 0.99 D of accommodation instead of the 2.43 D it needs without them

#### Scenario: The sign names the lens
- **WHEN** the power is negative, or positive
- **THEN** the glasses are labelled and drawn as a diverging (concave), or a converging (convex) lens

### Requirement: The correcting power allows for the vertex distance
The system SHALL give the power that fully corrects a refractive error K as Fs = K/(1 + dK), the lens whose second focal point coincides with the eye's far point.

#### Scenario: Myopia
- **WHEN** an eye with K = −3.0 D wears glasses at 12 mm
- **THEN** the correcting power reported is −3.11 D
- **AND** with −3.00 D glasses a distant object reaches the cornea with a vergence of −2.90 D, leaving 0.10 D of myopia

#### Scenario: Hyperopia
- **WHEN** an eye with K = +3.0 D and the lens held relaxed wears glasses at 12 mm
- **THEN** the correcting power reported is +2.90 D

#### Scenario: Vertex distance matters for strong lenses
- **WHEN** K is −6.0 D
- **THEN** the correcting power at 12 mm is −6.47 D, and at 0 mm it is −6.00 D

### Requirement: Glasses are compared with the bare eye
While the glasses are on, the system SHALL show the measurements of the eye and its image both with and without them for the same object.

#### Scenario: Before and after
- **WHEN** a myopic eye looking at a distant chart puts on its correcting glasses
- **THEN** the focus position, the blur-disc diameter and the sharpness grade are shown for both cases, and the image with glasses is the sharper

### Requirement: The correction is found by experiment
In experiment mode the system SHALL withhold the correcting power, so that the student finds it by changing the glasses until the image is sharp, and the notebook SHALL convert the power found into the refractive error K = Fs/(1 − d Fs).

#### Scenario: Subjective refraction
- **WHEN** a student records that −3.00 D glasses at 12 mm make the distant chart sharp
- **THEN** the notebook gives K = −2.90 D, and compares it with the eye's value once the theory is revealed

#### Scenario: Over-correction of a young eye
- **WHEN** a young myopic eye wears glasses stronger than its correction
- **THEN** the image of a distant chart stays sharp because the eye accommodates, and the guide tells the student to take the weakest negative lens that gives a sharp image

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
