# diverging-lens Specification

## Purpose
Defines how diverging (concave) thin lenses behave on the optical bench and how their negative focal length is measured.

## Requirements

### Requirement: A diverging lens forms a virtual image of a real object
For a real object the system SHALL solve 1/f = 1/do + 1/di with f < 0, giving a virtual, upright, reduced image on the object side, and SHALL NOT show a sharp image on the screen.

#### Scenario: Object 30 cm in front of an f = −15 cm lens
- **WHEN** an object is 30.0 cm in front of a lens with f = −15 cm
- **THEN** the image distance is −10.0 cm, the magnification is +0.333 and the image is reported as virtual, upright and reduced

### Requirement: A diverging lens images a virtual object
When converging light from an earlier lens meets a diverging lens before its focus, the system SHALL treat the intercepted image as a virtual object (do < 0) and place the new image according to the thin-lens equation.

#### Scenario: Convex lens followed by a concave lens
- **WHEN** a convex lens would form an image 10.0 cm behind an f = −15 cm lens
- **THEN** the real image forms 30.0 cm behind the concave lens

### Requirement: Concave-lens experiment recovers the focal length
The notebook SHALL compute f = (1/di − 1/s)⁻¹ from the distance s between the concave lens and the image formed without it, and the distance di to the image formed with it.

#### Scenario: Ideal measurement
- **WHEN** the student records s = 10.0 cm and di = 30.0 cm
- **THEN** the notebook reports f = −15.0 cm
