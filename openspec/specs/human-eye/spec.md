# human-eye Specification

## Purpose
Defines the schematic human eye of the laboratory: how the cornea and the lens together focus light on the retina, how accommodation and its loss with age move the focus, how refractive errors arise, and how the image on the retina is blurred when the focus misses it.

## Requirements

### Requirement: The eye is a cornea and a lens traced paraxially
The system SHALL model the eye as one corneal surface, an aqueous chamber, a lens with two surfaces and a vitreous chamber ending at the retina, each surface having the power (n′ − n)/r, and SHALL obtain the powers and the image position from the paraxial ray-transfer matrix of the whole eye.

#### Scenario: The relaxed normal eye
- **WHEN** the normal eye is relaxed
- **THEN** the corneal power is 42.7 D, the lens power 21.8 D and the total power 60.5 D
- **AND** light from a distant object is focused on the retina, 23.9 mm behind the cornea

#### Scenario: Curvature sets the power
- **WHEN** the corneal radius is changed from 7.8 mm to 7.29 mm
- **THEN** the corneal power shown is 45.7 D and no power can be entered directly

### Requirement: Accommodation steepens the lens
The system SHALL change the curvature of both lens surfaces, the lens thickness and the chamber depth together between the relaxed and the accommodated state, and SHALL report the accommodation as the object vergence at the cornea that the eye focuses on the retina, relative to its relaxed state.

#### Scenario: The accommodated schematic eye
- **WHEN** the lens of the normal eye is in the accommodated state of the schematic eye
- **THEN** the lens power is 32.3 D and an object 11.6 cm in front of the cornea is in focus (8.6 D of accommodation)

### Requirement: The eye accommodates by itself as far as it can
By default the system SHALL set the accommodation that puts the image of the object on the retina. When that needs more than the largest accommodation, or less than none, the system SHALL hold the nearest limit and leave the image out of focus. The student SHALL be able to hold the lens at a chosen state instead.

#### Scenario: Object within reach
- **WHEN** a normal eye of age 20 looks at an object 25 cm away
- **THEN** the accommodation in use is 4.0 D and the image is in focus

#### Scenario: Object nearer than the near point
- **WHEN** a normal eye of age 55 looks at an object 25 cm away
- **THEN** the accommodation in use is 2.0 D, the accommodation needed is 4.0 D and the focus lies behind the retina

#### Scenario: Accommodation held by the student
- **WHEN** the student holds the lens relaxed and moves the object from far to 25 cm
- **THEN** the focus moves 1.55 mm behind the retina and the accommodation in use stays 0 D

### Requirement: The largest accommodation falls with age
The system SHALL take the largest accommodation from Hofstetter's average, A = 18.5 − 0.30 × age dioptres, never below zero, for ages 15 to 75, and SHALL state on screen that this is a population average. Age SHALL change nothing else in the eye.

#### Scenario: Near point at three ages
- **WHEN** the age of a normal eye is set to 20, 45 and 55
- **THEN** the largest accommodation is 12.5 D, 5.0 D and 2.0 D
- **AND** the near point is 8.0 cm, 20 cm and 50 cm in front of the cornea

#### Scenario: Age leaves the far point alone
- **WHEN** the age of a relaxed eye is changed
- **THEN** its corneal power, relaxed lens power, axial length and far point do not change

### Requirement: Refractive errors come from the eye's length or its cornea
The system SHALL report the refractive error K as the vergence at the cornea of the point the relaxed eye focuses on the retina, and SHALL offer the conditions normal, myopia, hyperopia and presbyopia as settings of the axial length, the corneal radius and the age.

#### Scenario: Axial myopia
- **WHEN** the axial length is 25.04 mm with the normal cornea
- **THEN** K is −3.0 D, the far point is 33.3 cm in front of the eye and light from a distant object is focused 1.14 mm in front of the retina

#### Scenario: Axial hyperopia
- **WHEN** the axial length is 22.85 mm and the lens is held relaxed
- **THEN** K is +3.0 D and light from a distant object is focused 1.05 mm behind the retina

#### Scenario: A young hyperope sees far by accommodating
- **WHEN** an eye of age 20 with K = +3.0 D looks at a distant object with automatic accommodation
- **THEN** the image is in focus with 3.0 D of accommodation in use

#### Scenario: Presbyopia
- **WHEN** the presbyopia condition is chosen
- **THEN** the eye has the normal length and cornea and an age at which the near point lies beyond 40 cm

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

### Requirement: The scene is drawn from the model
The side view SHALL draw the cornea and the lens surfaces from their current radii, the lens thickness, the pupil and the retina from the model, and the rays from the paraxial trace, including the point where they cross in front of or behind the retina. Structures that are anatomy only SHALL be labelled as such. An unknown eye SHALL be drawn with the standard length and cornea and labelled as not to scale.

#### Scenario: Focus in front of the retina
- **WHEN** a myopic eye looks at a distant object
- **THEN** the rays are drawn crossing in front of the retina and spreading to a patch on it whose height is the blur-disc diameter

#### Scenario: The lens changes shape
- **WHEN** the accommodation increases
- **THEN** the drawn lens surfaces become more curved and the lens thicker, by the amounts the model uses

#### Scenario: An unknown eye cannot be measured off the drawing
- **WHEN** the eye's unknowns are concealed and the theory is not revealed
- **THEN** the eyeball is drawn with the standard length and cornea, with a label saying it is not to scale, and no rays are drawn inside the eye

### Requirement: Measurements of the eye are reported
The system SHALL show the object distance, the corneal, lens and total powers, the accommodation in use and needed, the far and near points, the position of the focus relative to the retina, the blur-disc diameter and a sharpness grade defined by the ratio of the blur-disc diameter to the stroke width of the chart's letters on the retina.

#### Scenario: Sharpness grade
- **WHEN** the blur-disc diameter is at most a quarter of the stroke width
- **THEN** the grade is "sharp"
- **AND** larger ratios are graded "slightly blurred", "blurred" and "unreadable" at stated limits

### Requirement: Calculated values are withheld in experiment mode
In experiment mode, until the student reveals the theory, the system SHALL withhold the refractive error, the far and near points, the accommodation, the focus position and the blur-disc diameter, and SHALL leave visible what a subject and an optician can observe: the object distance, the glasses power and the image.

#### Scenario: Finding the near point by looking
- **WHEN** a student in experiment mode moves the object towards the eye
- **THEN** the image stays sharp down to the near point and blurs beyond it, with no near-point value shown

#### Scenario: An unknown eye in an exam
- **WHEN** an exam question's bench is an eye with its unknowns concealed
- **THEN** the axial length, corneal radius and age are not shown and cannot be changed or revealed

### Requirement: The eye experiments analyse the student's readings
The system SHALL offer the experiments "Accommodation and the near point", "Myopia, hyperopia and glasses" and "Ageing and reading glasses" in a topic of their own, each with a guide, the model's assumptions and limits, and a notebook analysis.

#### Scenario: Amplitude from the far and near points
- **WHEN** a student records a near point of 20 cm for an eye whose far point is at infinity
- **THEN** the notebook gives an accommodation amplitude of 5.0 D

#### Scenario: Limits are stated
- **WHEN** an eye experiment's guide is opened
- **THEN** it lists that off-axis aberrations, irregular astigmatism, diffraction at the pupil and the processing by the retina and brain are not modelled
- **AND** it says which of astigmatism, chromatic aberration and spherical aberration are switched off in that experiment

### Requirement: Two ages can be compared
The system SHALL let the student add a second eye that differs from the first only in age, looking at the same object through the same glasses, and SHALL show both images and both sets of measurements.

#### Scenario: Young and old at reading distance
- **WHEN** eyes of age 20 and 60 with normal length look at an object 40 cm away without glasses
- **THEN** the image of the younger eye is sharp and that of the older eye is blurred, and both far-distance images are sharp

### Requirement: The sharpness grade uses one measure of blur for every eye
The system SHALL grade the sharpness from the equivalent blur diameter, 2√2 times the root-mean-square radius of the light of one object point on the retina, weighted by luminance in white light. For a uniform disc this SHALL be the disc's diameter.

#### Scenario: Symmetric eye
- **WHEN** the blur is a uniform disc of 295 µm
- **THEN** the equivalent blur diameter is 295 µm and the grade is the one of the symmetric eye

#### Scenario: A line
- **WHEN** the blur is a line 150 µm long
- **THEN** the equivalent blur diameter is 106 µm
