# Build BdayMate

## Why

The upstream repository only contains README and LICENSE. Implement the complete birthday-management platform specified in docs/requirements.md.

## Scope

Identity, owner-isolated contacts/tags, civil-date and lunar engine, dashboard/calendar, reminders and durable email queue, wishes/gifts/notifications, CSV, settings, operational docs and tests.

## Non-goals

No third-party contact messaging, no bulk marketing, no digest features marked future in the brief, no production publication without an approved destination. No changes outside this repository.

## Acceptance

Unit boundary cases, real PostgreSQL ownership/transactions, SMTP protocol delivery/retry/concurrency tests, registration-to-reminder browser E2E, responsive UI, lint/typecheck/production build, no tracked secrets, UTF-8 validation. External SMTP credentials are explicitly deferred by user.
