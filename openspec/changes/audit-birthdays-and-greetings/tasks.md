# Implementation plan

- [x] Audit birthday service, calendar and dashboard against independent references; add regressions and correct verified defects.
- [x] Add failing database/local SMTP tests for explicit owner opt-in and independence from self reminders.
- [x] Add owned greeting settings, additive migration, domain validation and workspace DTO.
- [x] Extend planning/dispatch with greeting templates, revalidation, privacy and dedupe/retry protection.
- [x] Add user controls and browser tests for both delivery modes.
- [x] Verify advance reminders, year rollover, cancellation, concurrency and SMTP failures.
- [x] Run full tests, lint, typecheck, build, formatting, encoding and credential diff checks.
- [x] Commit/push intended changes and verify production deployment.
- [x] Configure authorized Actions secrets/URL, isolated acceptance and automatic schedule; report limitations (active schedule and successful manual acceptance; first schedule event not yet observed).
