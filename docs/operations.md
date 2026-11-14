# Operations and rollback

## Deployment checklist

For Vercel, follow [the Vercel deployment guide](vercel.md). Cron supports authenticated GET and POST. The Docker Worker below requires a separate persistent container host; it is not started inside a Vercel Function.

1. Choose the deployment host, set public HTTPS origin, and configure provider SMTP. No production host has been selected or published by this development task.
2. Create a Neon backup/branch before applying migrations to any existing production database. `pnpm db:status` shows pending migrations; inspect SQL first.
3. Run `pnpm db:migrate` once from a controlled release environment using DIRECT_URL. Never use `prisma migrate reset` against user data.
4. Run all checks, then build with the correct NEXT_PUBLIC_APP_URL. Runtime BETTER_AUTH_URL must match the public origin. Do not expose .env files or test mail-capture services.
5. Either run `pnpm build && pnpm start` with an external authenticated scheduler, or `docker compose up --build -d` behind an HTTPS reverse proxy. The compose Worker is a separate Node process that keeps running when all browsers are closed. It calls generate every five minutes and consume every minute, retries the next cycle if the app is temporarily unavailable.
6. Verify test mail acceptance and real inbox receipt. Verify authentication verification/reset emails, one due reminder, failed delivery visibility and a subsequent successful retry. Inspect SMTP provider records if status is DELIVERY_UNCERTAIN.
7. Monitor non-2xx Cron responses, FAILED queues, stale PROCESSING, rejected sender addresses, database availability and provider quotas. In horizontally scaled deployments enforce shared edge rate limits in addition to application auth limits.

## Backups and rollback

Migration files are append-only after deployment. Roll back application image to the previous compatible release first. For a failed schema migration, inspect `prisma migrate status` and Prisma's failed-migration guidance; use a corrective migration rather than guessing whether SQL executed.

The initial migration only creates `bday_*` tables and enum types. Before any destructive database rollback, export user data and create a Neon restore point/branch, verify it, obtain explicit authorization, stop the Worker, and restore the database to the prior checkpoint. Restoring a checkpoint can discard new records; do not execute it as an automatic recovery step. No destructive rollback command is shipped or run. In an empty acceptance database, the reversible alternative is deleting only the recorded test-created user IDs (cascades their own fixtures).

## SMTP delivery semantics

The application persists tasks before send; transactions, dedupe keys, attempt counters and row locks coordinate concurrent workers. A positive SMTP reply proves acceptance, not inbox delivery. If a connection is lost around the final DATA acknowledgement or a claimed worker disappears, automatic re-sending could duplicate mail; these tasks require provider-side review. Do not change DELIVERY_UNCERTAIN rows to PENDING without that review.

Expired credentials and definite SMTP rejections are visible in logs; safe transient failures use bounded exponential backoff. Retries stop at five attempts and do not send stale birthday reminders after the birthday date. Global email off, contact archive and schedule changes cancel obsolete unsent tasks.

## Data handling

Production data never belongs in tests. Integration and E2E use unique test identities and scoped Cron calls. Cleanup queries use exact IDs recorded by the test, never wildcard email deletions or a full-table truncate. All database and SMTP credentials stay in environment variables. API error bodies are sanitized; no connection URLs, passwords, session tokens or reset links are logged.

## Date and retry details

The planning window covers the next 45 local send dates and looks ahead up to 45 additional birthday days for configured lead times. Newly configured reminders do not backfill past lead dates, but today's passed send time is still queued. Existing due/retry jobs may be delivered until the birthday itself, with current countdown copy recalculated at send time.

At daylight-saving overlap the earlier UTC instant is selected. At a nonexistent local time, the time advances by the DST gap. Jobs left PROCESSING for 15 minutes are quarantined as DELIVERY_UNCERTAIN. Cancelled jobs do not consume delivery attempts; sent/uncertain dedupe keys are retained.
