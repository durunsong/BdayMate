# BdayMate Implementation Plan

Goal: deliver the entire requirements.md as a runnable real database application. Architecture and constraints: design.md and platform/spec.md. Execution: subagent-driven-development for isolated implementation units; controller integrates sequentially and verifies final app. Initial development had no commit authorization; the subsequent user request explicitly authorizes committing and pushing the complete code and Vercel configuration.

- [x] 1. Foundation: package/config, Prisma schema/migration, real Neon connection, Better Auth and shared email infrastructure. Schema/generate/typecheck passed; two migrations applied.
- [x] 2. Birthday engine: write tests first for leap days/lunar new year/leap month/timezone; implement services/birthday.ts + adapter. All 69 birthday cases passed.
- [x] 3. Owned domain: validators, contacts/tags/CSV/wishes/gifts/settings/notifications services with owner scoping; real PostgreSQL tests passed, including 500 contacts and 2000 queued reminders without truncation.
- [x] 4. Reminder reliability: queue planner/worker + Cron endpoints, transaction claim, retries/dedupe/invalidation; real local SMTP integration tests passed. External-provider delivery explicitly deferred by user.
- [x] 5. Product UI: auth screens, protected shell, dashboard, contacts forms/detail, calendar, groups, reminders, wishes, settings; service-backed actions and mobile screenshot review complete.
- [x] 6. Acceptance: registration verification login contact reminder queue send logs E2E; cross-user tests and mobile checks passed. Fixed password-required account deletion, dataset truncation and SMTP test failure logging.
- [x] 7. Operations: README, .env.example, deployment/Cron/rollback instructions and progress evidence delivered. Lint/typecheck/format/test/build passed; Docker image and production-container smoke passed. Source encoding/secret audit documented in docs/progress.md.

Development acceptance is complete within the user's revised scope. Deferred external configuration gates are tracked separately, not claimed as passed:

- External SMTP credentials remain `xxxx` as requested; real public-inbox delivery awaits the user's configuration.
- Platform selected: Vercel Hobby with the repository GitHub Actions scheduler. The actual public HTTPS origin and platform environment/secret values still need to be set; online deployment is not claimed.
- Daily/weekly digests were explicitly future scope in the requirements.

Full evidence and operational limitations: [development progress](../../../docs/progress.md).

- [x] 8. Vercel Hobby: Node 22/Corepack/Singapore configuration, authenticated GET compatibility, GitHub Actions five-minute scheduler, secure standard-library runner and deployment instructions. Unit/integration suite: 146 passing; browser E2E: 3 passing. Platform URL, SMTP and remote secret activation remain explicit configuration gates.
