# BdayMate

Follow the workspace and personal_code rules. User authorizes building this new project and non-destructive new-table migration in the supplied Neon database, including isolated acceptance test data. No commits, pushes or production deployment without explicit request.

- Architecture: Next App Router -> authenticated Server Actions / Route Handlers -> services -> Prisma. UI never imports Prisma. Server infrastructure imports server-only.
- Source of requirements: docs/requirements.md; plan/progress: openspec/changes/build-bdaymate/.
- Every business operation scopes by authenticated userId; composite ownership foreign keys protect contact/tag/gift associations. Never accept userId from client.
- Birthday calculations are civil dates in user's IANA timezone; queue timestamps UTC. SOLAR Feb 29 defaults Feb 28; LUNAR missing leap month defaults regular month and short months clamp to last day; both policies explicit/editable. Lunar supported interval must be enforced and documented.
- Self-reminder recipients are account owners. User-authorized birthday greetings may target the current contact email only after explicit per-contact opt-in; keep private notes/age/relationship/account links out of greeting content. Queue uses atomic SQL claim, unique dedupeKey, bounded retries. SMTP lacks universal exactly-once guarantees: ambiguous accepted sends require review, not blind retry.
- Credentials only in ignored local environment files; never log URLs/secrets. SMTP placeholders are not valid credentials. Tests use local SMTP capture; external delivery awaits user configuration.
- Commands: pnpm test:unit, pnpm test:integration, pnpm test:e2e, pnpm lint, pnpm typecheck, pnpm build. Verify commands before claiming pass.
- UTF-8 without BOM; preserve LICENSE. All deliberate deviations and remaining acceptance gates belong in docs/progress.md.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
