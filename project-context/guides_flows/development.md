# Local development

1. Install toolchain pins from [package.json](../../package.json); make Docker Compose available.
2. Run `pnpm install --frozen-lockfile` at the repository root.
3. Defaults: `pnpm dev:local`. To customize, first create `.env.local` from [.env.local.example](../../.env.local.example) only if absent. Keep credentials out of Git.
4. Set matching `LOCAL_POSTGRES_PASSWORD`, `LOCAL_WEB_PASSWORD`, `LOCAL_IDENTITY_PASSWORD` and connection URLs. The launcher uses `LOCAL_WEB_PORT`, `LOCAL_API_PORT`, `LOCAL_POSTGRES_PORT`, `LOCAL_APP_ORIGIN`; generic `APP_ORIGIN` alone does not override the launcher's default.
5. Open loopback `3000` (or selected port), login with email/Thai mobile, complete onboarding. API defaults to `3001`; PostgreSQL to `55433`.
6. Ctrl-C stops application processes. PostgreSQL/volume persists; `docker compose -f infra/compose.local.yaml stop` stops the DB service without deleting data.

The launcher generates client/applies migrations using admin credentials, gives runtime URLs to Nest and starts Next with an isolated environment. It does not reset local/QAS. Changing init passwords after a volume exists does not change database roles; use the database runbook for credential changes.

## Demo data

In another terminal, after configuring `.env.local` from the example:

```bash
set -a
source .env.local
set +a
pnpm seed:local
```

Seed accepts only a loopback `postgres` administrator URL for `/deledger_local`. Synthetic identities/sample month live in [seed-local.mjs](../../scripts/seed-local.mjs); existing seeded Users are skipped. Seeding is optional.

Use `pnpm qc` and [QA guidance](../qa_testing/README.md). Stop local Next before E2E from the same checkout: different ports still share `.next/dev`. Use a separate checkout if development must continue.

QAS work follows the [deployment runbook](../../docs/operations/deploy-private-beta.md); local login is not a QAS fallback. Do not source QAS credentials to start a local application.
