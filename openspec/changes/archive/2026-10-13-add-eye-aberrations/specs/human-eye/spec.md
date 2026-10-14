# Spec Delta

## MODIFIED Requirements

### Requirement: Blur on the retina follows from the pupil and the defocus
For an eye with a symmetric cornea, in light of one wavelength and traced paraxially, the system SHALL compute the blur-disc diameter on the retina as twice the height at the retina of the ray from the axial object point through the edge of the pupil, and SHALL show the test chart at its retinal size, convolved with a uniform disc of that diameter.

#### Scenario: Out of focus
- **WHEN** a normal eye with no accommodation left and a 4 mm pupil looks at an object 25 cm away
- **THEN** the blur-disc diameter is 295 µm

#### Scenario: In focus
- **WHEN** the image of the object lies on the retina
- **THEN** the blur-disc diameter is zero and the chart is shown sharp

#### Scenario: A smaller pupil blurs less
- **WHEN** the pupil diameter is halved with everything else unchanged
- **THEN** the blur-disc diameter is halved and the image is a quarter as bright

### Requirement: The eye experiments analyse the student's readings
The system SHALL offer the experiments "Accommodation and the near point", "Myopia, hyperopia and glasses" and "Ageing and reading glasses" in a topic of their own, each with a guide, the model's assumptions and limits, and a notebook analysis.

#### Scenario: Amplitude from the far and near points
- **WHEN** a student records a near point of 20 cm for an eye whose far point is at infinity
- **THEN** the notebook gives an accommodation amplitude of 5.0 D

#### Scenario: Limits are stated
- **WHEN** an eye experiment's guide is opened
- **THEN** it lists that off-axis aberrations, irregular astigmatism, diffraction at the pupil and the processing by the retina and brain are not modelled
- **AND** it says which of astigmatism, chromatic aberration and spherical aberration are switched off in that experiment

## ADDED Requirements

### Requirement: The sharpness grade uses one measure of blur for every eye
The system SHALL grade the sharpness from the equivalent blur diameter, 2√2 times the root-mean-square radius of the light of one object point on the retina, weighted by luminance in white light. For a uniform disc this SHALL be the disc's diameter.

#### Scenario: Symmetric eye
- **WHEN** the blur is a uniform disc of 295 µm
- **THEN** the equivalent blur diameter is 295 µm and the grade is the one of the symmetric eye

#### Scenario: A line
- **WHEN** the blur is a line 150 µm long
- **THEN** the equivalent blur diameter is 106 µm
