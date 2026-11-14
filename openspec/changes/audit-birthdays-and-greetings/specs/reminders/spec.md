## ADDED Requirements

### Requirement: Explicit contact birthday greetings

The system SHALL send one greeting per birthday occurrence to the current contact email only after explicit owner opt-in.

#### Scenario: Independent delivery

- WHEN self reminders are disabled and a contact greeting is enabled
- THEN only the greeting is planned for the birthday at its configured local time.

#### Scenario: Revalidation and privacy

- WHEN settings or contact data change before dispatch
- THEN delivery uses current authorized data, cancels invalid or expired jobs and omits private notes and account links.

#### Scenario: Repeat workers

- WHEN generation and workers repeat
- THEN no duplicate occurrence is sent; uncertain SMTP outcomes require manual review.

### Requirement: Annual calendar verification

The system SHALL compute annual occurrences from the stored calendar and explicit leap policies within the documented range.

#### Scenario: Calendar boundaries

- WHEN querying leap years, leap months, short months, timezones and year boundaries
- THEN independent reference fixtures and UI statistics agree with generated occurrences, including two lunar anniversaries in one Gregorian year.

### Requirement: Automatic schedule

The system SHALL execute without an open browser and disclose best-effort scheduling.

#### Scenario: Scheduled workflow

- WHEN production secrets and URL are configured and the default branch workflow runs
- THEN generation and delivery use authenticated requests and expose failures.
