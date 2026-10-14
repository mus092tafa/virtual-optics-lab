# Spec Delta

## Purpose

Defines the spherical aberration of the laboratory's eye: surfaces that are conicoids, rays traced exactly instead of paraxially, the dependence of the focus on the height of the ray in the pupil, and the image this leaves on the retina.

## ADDED Requirements

### Requirement: Real rays can be traced through conicoid surfaces
The system SHALL let the student switch from paraxial rays to real rays, refracted by Snell's law at each surface of the eye, and SHALL let the asphericity Q of the cornea and of the lens be set, Q = 0 being a sphere. With paraxial rays the asphericity SHALL change nothing.

#### Scenario: A single refracting sphere
- **WHEN** a ray parallel to the axis meets a sphere of radius 7.8 mm into a medium of index 4/3 at a height of 3 mm
- **THEN** it crosses the axis 29.86 mm behind the vertex, while the paraxial focus is at 31.20 mm

#### Scenario: A stigmatic ellipsoid
- **WHEN** the same surface has Q = −(1/n′)² = −0.5625
- **THEN** rays at every height cross the axis at 31.20 mm

#### Scenario: Rays near the axis
- **WHEN** the pupil is made very small
- **THEN** the real rays cross the axis at the paraxial focus

### Requirement: The zone refraction is reported
The system SHALL report, for the ray through the edge of the open pupil or through the middle of the ring of a ring stop, its height in the pupil, the place where it crosses the axis, and the difference between the paraxial refractive error and the vergence at the cornea of the object point that this ray images on the retina, as the longitudinal spherical aberration in dioptres.

#### Scenario: Spherical surfaces
- **WHEN** the relaxed normal eye with spherical surfaces and a 4 mm pupil looks at a distant object with real rays
- **THEN** the marginal ray crosses the axis 0.73 mm in front of the retina and the spherical aberration shown is 2.1 D

#### Scenario: The average eye
- **WHEN** the shape preset "average eye" is chosen
- **THEN** the cornea has Q = −0.26, the lens has the asphericity that leaves 1.0 D of spherical aberration for a distant ray entering 3 mm from the axis, and both values are shown

### Requirement: Real rays give the light on the retina
With real rays the system SHALL compute the light of one object point on the retina from rays spread evenly over the area of the pupil, SHALL show the chart convolved with it, and SHALL report an equivalent blur diameter, 2√2 times the root-mean-square radius of that light.

#### Scenario: In paraxial focus but not sharp
- **WHEN** the relaxed normal eye with spherical surfaces and a 6 mm pupil looks at a distant object with real rays
- **THEN** the equivalent blur diameter is 0.40 mm although the paraxial focus is on the retina

#### Scenario: The smallest blur moves with the pupil
- **WHEN** the average eye, held relaxed, looks at a distant chart through glasses
- **THEN** the equivalent blur diameter is smallest with about −0.1 D for a 2 mm pupil and with about −1.6 D for an 8 mm pupil

#### Scenario: A uniform disc
- **WHEN** the light on the retina is a uniform disc
- **THEN** the equivalent blur diameter is the diameter of the disc

### Requirement: A ring stop selects one zone of the pupil
With real rays the system SHALL let the student cover the middle of the pupil, leaving a ring open from a chosen fraction of the pupil's radius to its edge, SHALL trace only rays through the ring, SHALL dim the image by the covered area, and SHALL show the radii of the ring and its root-mean-square radius h. With paraxial rays the stop SHALL have no effect and the system SHALL say so.

#### Scenario: A narrow ring has one focus
- **WHEN** the relaxed normal eye with spherical surfaces has a 6 mm pupil with the inner nine tenths of its radius covered
- **THEN** the ring is open from 2.70 to 3.00 mm with h = 2.85 mm, and the spherical aberration shown for it is 4.9 D
- **AND** glasses of −5.19 D at 12 mm leave less than a tenth of the blur there is without glasses

#### Scenario: The average eye
- **WHEN** the same ring is set on the average eye
- **THEN** the spherical aberration shown is 1.1 D

#### Scenario: Paraxial rays
- **WHEN** a ring stop is set while paraxial rays are traced
- **THEN** the image is that of the open pupil and a notice says that the stop needs real rays

### Requirement: Real rays are offered only where the model covers them
The system SHALL trace real rays only in an eye with a symmetric cornea and glasses without cylinder, SHALL say so on screen when the option is unavailable, and SHALL report rays that miss a surface or are totally reflected instead of drawing them.

#### Scenario: Astigmatic eye
- **WHEN** the cornea has two different radii
- **THEN** the real-ray option is unavailable, with the reason shown, and the eye is traced paraxially

### Requirement: Calculated values of the aberrated eye are withheld in experiment mode
In experiment mode, until the theory is revealed, the system SHALL withhold the spherical aberration, the equivalent blur diameter and the crossing of the marginal ray, and for an unknown eye SHALL also hide the asphericities.

#### Scenario: Experiment mode
- **WHEN** a student in experiment mode changes the pupil
- **THEN** the image changes and no value of the spherical aberration is shown

### Requirement: The spherical aberration experiment analyses the student's readings
The system SHALL offer the experiment "Spherical aberration and the pupil" with a guide, the model's assumptions and limits, and a notebook that takes the radius of a ring, the glasses found sharpest through it and the glasses found sharpest with the open 2 mm pupil, gives the aberration of that zone, and plots it against the square of the radius.

#### Scenario: Aberration of a zone
- **WHEN** a student records h = 2.85 mm, −1.25 D through the ring and 0.00 D at the centre, at a vertex distance of 12 mm
- **THEN** the notebook gives an aberration of 1.23 D and, once the theory is revealed, compares it with the model's value for that radius

#### Scenario: Straight line
- **WHEN** rings of 1.0, 1.5, 2.0 and 2.5 mm are recorded with the lenses that correct them in the average eye
- **THEN** the fitted slope is 0.135 D/mm², compared with the model's 0.122 D/mm² near the axis
