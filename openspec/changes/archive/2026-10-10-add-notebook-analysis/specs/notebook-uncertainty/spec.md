# Spec Delta

## Purpose

Lets students state every notebook result with an uncertainty derived from the reading uncertainty of the quantities they measured.

## ADDED Requirements

### Requirement: Each measured quantity carries a reading uncertainty
The notebook SHALL prefill an uncertainty for every measurement field from the resolution of the instrument used, and SHALL let the student change it before recording.

#### Scenario: Rail distance
- **WHEN** the student opens the notebook of the convex-lens experiment
- **THEN** the uncertainty of do and di is prefilled with 0.1 cm

### Requirement: Uncertainties are propagated to results
The notebook SHALL compute the uncertainty of each result as the square root of the sum of squares of (∂result/∂xᵢ · Δxᵢ) over the measured quantities xᵢ.

#### Scenario: Focal length from conjugate distances
- **WHEN** the student records do = 30.0 ± 0.1 cm and di = 15.0 ± 0.1 cm
- **THEN** the notebook reports f = 10.00 ± 0.05 cm

#### Scenario: Zero uncertainty
- **WHEN** every reading uncertainty is set to zero
- **THEN** the result is reported with an uncertainty of zero

### Requirement: Agreement with the accepted value is stated in units of the uncertainty
When the accepted value is visible the notebook SHALL state how many uncertainties separate the result from it.

#### Scenario: Result within its uncertainty
- **WHEN** a result of 10.03 ± 0.05 cm is compared with an accepted 10.00 cm
- **THEN** the notebook states that they agree within the uncertainty

### Requirement: Repeated measurements are summarised
With two or more recorded rows the notebook SHALL show the mean of each result and its standard error.

#### Scenario: Three recorded rows
- **WHEN** three rows give f = 9.9, 10.0 and 10.1 cm
- **THEN** the summary shows a mean of 10.00 cm with a standard error of 0.06 cm
