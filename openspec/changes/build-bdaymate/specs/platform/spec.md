# Platform acceptance specification

The full authoritative feature inventory is docs/requirements.md.

## Identity and ownership

GIVEN two verified users WHEN each creates/reads/updates/deletes contacts, tags, wishes, gifts, notifications or queues THEN no user's identifiers authorize the other's operations. Anonymous business routes redirect/reject. Verify/reset/change-email/delete-account use Better Auth tokens or current password.

## Birthday correctness

GIVEN civil dates around midnight, DST, year end, Feb29 and lunar new year/leap months THEN occurrences, countdown and age match user's timezone and documented policy; unknown birth year never has an age; unsupported range fails explicitly.

## Product flows

All specified routes render live owner data; dashboard five metrics, calendar month/week/list, contacts CRUD/filter/sort/archive/bulk/CSV, tags multi-association, wishes copy/sent records, gifts lifecycle, notification read state, settings/sessions/data export/delete are actionable. Empty/loading/error/pending states and responsive keyboard use required.

## Reminder reliability

Authenticated Cron generates rolling reminders without browsers. Only account owner receives emails. Duplicate generation creates one queue record per occurrence/lead time. Two workers cannot claim the same task. Failures are logged/retried with cap; preference/contact changes cancel obsolete pending tasks. Logs and manual failed retry are visible. SMTP test is rate-limited and only sends to signed-in owner.

## Delivery evidence

Run lint, strict typecheck, unit/integration/E2E, production build and UTF-8/secret checks after final edits. Live Neon migration authorized 2026-11-14; public-provider SMTP verification deferred by user's explicit instruction.
