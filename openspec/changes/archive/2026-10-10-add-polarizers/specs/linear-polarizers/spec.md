# Spec Delta

## Purpose

Defines how ideal linear polarisers change the power of the light travelling along the optical bench, so that Malus's law can be measured.

## ADDED Requirements

### Requirement: Unpolarised light loses half its power at a polariser
The system SHALL transmit half of the incident power when unpolarised light meets an ideal linear polariser, whatever the orientation of its axis.

#### Scenario: Single polariser
- **WHEN** one polariser is placed between the source and the screen
- **THEN** the relative irradiance at the screen reads 50 % for every axis angle

### Requirement: Polarised light obeys Malus's law
The system SHALL transmit the fraction cos²θ of linearly polarised light through a polariser whose axis makes the angle θ with the polarisation direction.

#### Scenario: Analyser at 60°
- **WHEN** a second polariser is set 60° from the first
- **THEN** the relative irradiance at the screen reads 12.5 %

#### Scenario: Crossed polarisers
- **WHEN** the second polariser is set 90° from the first
- **THEN** no light reaches the screen

#### Scenario: Third polariser between crossed polarisers
- **WHEN** a polariser at 45° is inserted between two crossed polarisers
- **THEN** the relative irradiance at the screen reads 12.5 %

### Requirement: Polarisers change brightness only
The system SHALL leave image position, magnification, focus, beam size and fringe spacing unchanged when polarisers are added or rotated.

#### Scenario: Polariser in an imaging setup
- **WHEN** a polariser is inserted between the object and the lens
- **THEN** the image distance and magnification are unchanged and the image brightness is halved

### Requirement: Malus experiment compares the reading with cos²θ
The notebook SHALL compute I/I₀ from the recorded readings and compare it with cos²θ for the recorded angle.

#### Scenario: Ideal measurement
- **WHEN** the student records θ = 30°, I = 37.5 % and I₀ = 50 %
- **THEN** the notebook reports I/I₀ = 0.75, equal to cos² 30°
