# spherical-mirror Specification

## Purpose
Defines how a spherical mirror on the optical bench reflects light back along the rail and forms images, so that its focal length can be measured.

## Requirements

### Requirement: A mirror images by the mirror equation
The system SHALL place the image of an object a distance do in front of a spherical mirror at di given by 1/f = 1/do + 1/di with f = R/2, with magnification m = −di/do, where a positive di is in front of the mirror.

#### Scenario: Object between F and C of a concave mirror
- **WHEN** an object is 30.0 cm in front of a concave mirror with f = 20 cm
- **THEN** the image is real, inverted and magnified, 60.0 cm in front of the mirror, with m = −2.0

#### Scenario: Object inside the focal length
- **WHEN** an object is 10.0 cm in front of a concave mirror with f = 20 cm
- **THEN** the image is virtual, upright and magnified, 20.0 cm behind the mirror

#### Scenario: Convex mirror
- **WHEN** an object is 30.0 cm in front of a convex mirror with f = −15 cm
- **THEN** the image is virtual, upright and reduced, 10.0 cm behind the mirror

### Requirement: The screen catches reflected light in front of the mirror
The system SHALL deliver the reflected light to a screen placed in front of the mirror, sharp when the screen is in the image plane and blurred by a disc of diameter D·|s − di|/|di| otherwise, where s is the mirror-to-screen distance and D the mirror aperture. A screen behind the mirror SHALL receive no light.

#### Scenario: Screen in the image plane
- **WHEN** the screen is 60.0 cm in front of the mirror in the first scenario above
- **THEN** the image on the screen is in focus

#### Scenario: Screen behind the mirror
- **WHEN** the screen is placed behind the mirror
- **THEN** the screen is dark

### Requirement: Unmodelled mirror configurations are reported
The system SHALL report the configuration as not modelled when a lens, slit, grating or circular aperture lies between the source and the mirror.

#### Scenario: Lens in front of the mirror
- **WHEN** a lens is placed between the object and the mirror
- **THEN** the screen shows a "not modelled" message

### Requirement: Mirror experiment recovers the focal length
The notebook SHALL compute f = (1/do + 1/di)⁻¹ and R = 2f from the recorded distances.

#### Scenario: Ideal measurement
- **WHEN** the student records do = 30.0 cm and di = 60.0 cm
- **THEN** the notebook reports f = 20.0 cm and R = 40.0 cm
