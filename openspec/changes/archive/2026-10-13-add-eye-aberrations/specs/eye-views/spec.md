# Spec Delta

## Purpose

Defines the views of the laboratory's eye beside its side view, so that light which does not behave the same in every plane through the axis can be followed: a top view, a front view and the cross-sections of the beam.

## ADDED Requirements

### Requirement: The eye can be seen from the side and from above
The system SHALL offer a top view, the horizontal section of the eye, beside the side view, the vertical section, each drawn to scale from the model with the corneal radius of its own meridian and with the rays that pass the edge of the pupil in its own plane.

#### Scenario: Two meridians, two pictures
- **WHEN** an eye with meridians of 7.80 mm (horizontal) and 7.45 mm (vertical) looks at a distant object
- **THEN** the rays of the top view cross on the retina and the rays of the side view cross 0.71 mm in front of it

#### Scenario: A symmetric eye
- **WHEN** the cornea has one radius and the glasses no cylinder
- **THEN** the top view and the side view show the same rays

#### Scenario: Oblique meridians
- **WHEN** the meridians of the cornea or the axis of the glasses lie neither horizontally nor vertically
- **THEN** both views say that the rays leave their plane and are drawn as projections

### Requirement: The front view shows the meridians
The system SHALL offer a view facing the eye with the pupil at its diameter, the two principal meridians of the cornea with their radii, the axis of the cylinder of the glasses, and a scale of degrees counted counter-clockwise from the horizontal.

#### Scenario: Axis of the glasses
- **WHEN** the glasses carry a cylinder with its axis at 30°
- **THEN** the front view shows the axis line at 30° on the scale

#### Scenario: Unknown eye
- **WHEN** the eye's unknowns are concealed and the theory is not revealed
- **THEN** the front view shows the pupil and the glasses but not the meridians of the cornea

### Requirement: The cross-sections of the beam are shown
The system SHALL show the outline of the light of one object point at several planes from in front of the first focus to behind the last, among them the retina, all at one scale and computed from the same rays as the image.

#### Scenario: Through the conoid of Sturm
- **WHEN** an astigmatic eye looks at an object
- **THEN** the cross-sections run from an ellipse through a line, a circle and a second line at right angles to the first, and the one at the retina equals the blur of the image

#### Scenario: A sharp image
- **WHEN** the image is in focus
- **THEN** the cross-section at the retina is a point

### Requirement: The views show light only when the theory is visible
The rays of the top view and the cross-sections of the beam SHALL be shown under the same condition as the rays of the side view.

#### Scenario: Experiment mode
- **WHEN** the calculated results are withheld
- **THEN** the top view shows the eye without rays and the cross-sections are not shown
