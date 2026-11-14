# Design and implementation decisions

## Application

Single Next.js App Router deployable. app defines pages and authenticated HTTP boundaries; features handles forms/client interaction; components contains shadcn-style Radix primitives; services owns business rules; lib owns infra; emails contains React Email; stores holds client-only navigation state.

## Data model

Better Auth User/Session/Account/Verification; Profile and ReminderPreference one-to-one User; Contact and Tag owned by User; ContactTag uses composite owner references; ContactReminderSetting one-to-one Contact; EmailQueue has unique dedupeKey, payload, scheduledAt UTC, status, attempts, claim token/time; EmailLog records each delivery result; Notification, WishTemplate, GiftRecord owned by User. Delete-user cascades; contact deletion removes associations and pending tasks without deleting unrelated users. Gift budget Decimal(12,2) with currency.

## Birthday rules

Explicit SOLAR Feb29 strategy FEB28/MAR1. LUNAR leap-month strategy REGULAR/SKIP; short-month day30 clamps to month end; unknown years have no age. Convert lunar-year candidates rather than matching Gregorian year. Date calculations use user's IANA zone and UTC civil-date arithmetic for day differences. Conversion supported range explicitly bounded.

## Security

Better Auth verified-email sessions; owner scope every read/mutation; Zod boundary validation; cookies/CSRF handled by Better Auth and Next Actions; Cron bearer validated constant-time. Export sanitizes spreadsheet formula injection; CSV has byte/row limits and all-or-nothing validation.

## Scheduling

Generate a rolling 45-day send window, looking ahead up to 45 additional birthday days for configured lead times. Persist UTC send instants from user civil dates/time. Unique contact/occurrence/lead-time dedupe. Atomically claim due rows with FOR UPDATE SKIP LOCKED; lease token prevents stale completion. Retry transient failures exponentially up to five attempts. Ambiguous SMTP outcomes never claimed exactly-once; quarantine expired processing tasks for provider-side review rather than blind retries. Preference/contact edits invalidate pending snapshots and regenerate under per-user transactional lock. No browser-trigger dependency.

## Deployment

Portable container and authenticated GET/POST Cron are available. The user selected Vercel Hobby: vercel.json sets Node 22, the Singapore region and Fluid Compute. GitHub Actions on the default main branch invokes the existing Cron endpoints every five minutes, with a small per-run queue batch and serialized runs. Missing production URL skips the job; secrets belong in platform settings. No always-on process runs inside Vercel. Local real SMTP capture covers the protocol; provider credentials and the actual production origin remain external configuration gates.

## Dependencies

Versions checked from official docs and npm registry on 2026-11-14. Prisma 7.10.1 explicitly pinned (8 latest is RC and Better Auth adapter not compatible). All additions directly implement requested stack or test infrastructure.
