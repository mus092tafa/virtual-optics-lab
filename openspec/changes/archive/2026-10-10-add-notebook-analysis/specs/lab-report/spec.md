# Spec Delta

## Purpose

Lets students export a written record of an experiment that they can print or hand in.

## ADDED Requirements

### Requirement: A report can be exported for the current experiment
The notebook SHALL offer an export that downloads a single self-contained HTML document containing the experiment title, aim, procedure, equations, model assumptions, the recorded measurements with their uncertainties and results, the summary, and the fitted graph when one exists.

#### Scenario: Export with recorded rows
- **WHEN** the student exports a report after recording three rows
- **THEN** the downloaded document lists all three rows and their results

### Requirement: The report does not reveal withheld theory
The report SHALL include accepted values and comparisons only when the theory is visible in the lab at the time of export.

#### Scenario: Experiment mode before revealing
- **WHEN** a report is exported in experiment mode with the theory hidden
- **THEN** the document contains no accepted values

### Requirement: Report content is safe to open
Text entered by the student SHALL appear in the report as text, never as markup.

#### Scenario: Name containing markup
- **WHEN** the student's name contains the characters < and >
- **THEN** they appear literally in the report
