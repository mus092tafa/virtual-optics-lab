# eye-astigmatism Specification

## Purpose
Defines the astigmatic eye of the laboratory: a cornea with two different curvatures, the two focal lines it forms instead of a focus, the refraction of such an eye as sphere, cylinder and axis, and the blur it leaves on the retina.

## Requirements

### Requirement: The cornea has two principal meridians
The system SHALL let the student set a second corneal radius, for the meridian at right angles to the first, and the orientation of the first meridian from 0° to 180°. Each meridian SHALL have the power (n′ − 1)/r. Angles SHALL be given as seen facing the eye, counter-clockwise from the horizontal. With equal radii the eye SHALL be the symmetric eye.

#### Scenario: With-the-rule astigmatism
- **WHEN** the horizontal meridian has the radius 7.80 mm and the vertical meridian 7.45 mm
- **THEN** the corneal powers shown are 42.7 D and 44.7 D, and the corneal astigmatism is 2.0 D

#### Scenario: Equal radii
- **WHEN** both radii are 7.80 mm
- **THEN** every measurement equals that of the symmetric eye, whatever the orientation

### Requirement: An astigmatic eye forms two focal lines
The system SHALL trace both meridians of the eye and SHALL report the positions of the two focal lines of an object point, the interval between them, and the direction of each line.

#### Scenario: The conoid of Sturm
- **WHEN** the relaxed eye with meridians of 7.80 mm (horizontal) and 7.45 mm (vertical) and the normal length looks at a distant object
- **THEN** one focal line lies on the retina and is vertical, the other lies 0.71 mm in front of the retina and is horizontal

#### Scenario: Rotating the cornea rotates the lines
- **WHEN** the cornea of that eye is turned by 30°
- **THEN** the positions of the focal lines do not change and their directions turn by 30°

### Requirement: The refraction of the eye is a sphere, a cylinder and an axis
The system SHALL report the refractive error of an astigmatic eye at the cornea as a sphere, a negative cylinder and its axis, the sphere being the refractive error of the less myopic meridian.

#### Scenario: Simple myopic astigmatism
- **WHEN** the eye has meridians of 7.80 mm (horizontal) and 7.45 mm (vertical) and the normal length
- **THEN** the refraction shown is 0.00 / −2.00 × 180

#### Scenario: Oblique astigmatism
- **WHEN** the cornea of that eye is turned by 30°
- **THEN** the refraction shown is 0.00 / −2.00 × 30

### Requirement: The blur of an astigmatic eye is an ellipse
The system SHALL compute the patch of light of one object point on the retina as the ellipse that the circular pupil maps to, SHALL report its two diameters and its direction, and SHALL show the chart convolved with that ellipse.

#### Scenario: A focal line on the retina
- **WHEN** the relaxed eye with meridians of 7.80 mm and 7.45 mm and a 4 mm pupil looks at a distant object
- **THEN** the blur is a vertical line 150 µm long, and the vertical strokes of the chart stay sharp while the horizontal strokes are blurred

#### Scenario: The circle of least confusion
- **WHEN** the same eye, held relaxed, looks at an object 1 m away
- **THEN** the blur is a circle of 75 µm

#### Scenario: A smaller pupil
- **WHEN** the pupil diameter is halved
- **THEN** both diameters of the ellipse are halved

### Requirement: An astigmatic eye accommodates to the circle of least confusion
When the eye accommodates by itself, the system SHALL set the accommodation that images the object midway between the two focal lines in dioptres, within the limits of the eye's age.

#### Scenario: Distant object
- **WHEN** an eye of refraction 0.00 / −2.00 × 180 looks at a distant object
- **THEN** the accommodation needed is −1.0 D, the accommodation in use is 0 D and the blur is a line

### Requirement: A fan chart shows the axis
The system SHALL offer a chart of radial lines, each labelled with its meridian in degrees as seen facing the eye, and SHALL show it as the eye sees it.

#### Scenario: The sharp line names the focal line
- **WHEN** an eye whose blur on the retina is a vertical line looks at the fan chart
- **THEN** the line labelled 90 is sharp and the line labelled 180 is the most blurred

### Requirement: Calculated values of the astigmatic eye are withheld in experiment mode
In experiment mode, until the theory is revealed, the system SHALL withhold the refraction of the eye, the focal lines and the blur diameters, and for an unknown eye SHALL also hide both corneal radii and the orientation.

#### Scenario: Unknown astigmatic eye
- **WHEN** an eye with its unknowns concealed is astigmatic
- **THEN** neither radius nor the orientation is shown, the front view shows no meridians, and the image and the glasses stay visible

### Requirement: The astigmatism experiment analyses the student's readings
The system SHALL offer the experiment "Astigmatism and the cylinder lens" with a guide, the model's assumptions and limits, and a notebook that converts the sphere, cylinder and axis found at the glasses into the refraction at the cornea.

#### Scenario: Refraction from the glasses found
- **WHEN** a student records that 0.00 / −2.00 × 180 at 12 mm makes the distant chart sharp
- **THEN** the notebook gives a refraction at the cornea of 0.00 / −1.95 × 180, and compares it with the eye's once the theory is revealed
