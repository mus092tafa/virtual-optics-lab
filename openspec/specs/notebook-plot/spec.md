# notebook-plot Specification

## Purpose
Lets students extract a physical quantity from the slope or intercept of a straight-line graph of their recorded measurements.

## Requirements

### Requirement: Recorded measurements are plotted in linearised form
For experiments with a linear relationship the notebook SHALL plot one point per recorded row using the linearising variables of that experiment, with labelled axes.

#### Scenario: Thin-lens graph
- **WHEN** rows of do and di are recorded in the convex-lens experiment
- **THEN** the graph shows 1/di against 1/do

### Requirement: A least-squares line is fitted
With three or more points the notebook SHALL fit y = a + b x by unweighted least squares and report the slope and intercept with their standard errors.

#### Scenario: Exact line
- **WHEN** the points (1, 3), (2, 5) and (3, 7) are fitted
- **THEN** the slope is 2, the intercept is 1 and both standard errors are zero

#### Scenario: Too few points
- **WHEN** fewer than three rows are recorded
- **THEN** the points are shown without a fitted line and the notebook states that three are needed

### Requirement: The physical quantity is derived from the fit
The notebook SHALL convert the fitted slope or intercept into the quantity of interest for the experiment, with its uncertainty propagated from the standard error.

#### Scenario: Focal length from the intercept
- **WHEN** 1/di against 1/do is fitted with intercept 0.100 ± 0.001 cm⁻¹
- **THEN** the notebook reports f = 10.0 ± 0.1 cm
