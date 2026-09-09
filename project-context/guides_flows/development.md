# Local development

1. Install toolchain pins from [package.json](../../package.json); make Docker Compose available.
2. Run `corepack enable`, then `pnpm install` at the repository root.
3. Defaults: `pnpm dev:local`. To customize, first create `.env.local` from [.env.local.example](../../.env.local.example) only if absent. Keep credentials out of Git.
4. Set `LOCAL_DATABASE_NAME` (default `deledger_local`) and `LOCAL_POSTGRES_PASSWORD`, `LOCAL_WEB_PASSWORD`, `LOCAL_IDENTITY_PASSWORD`. Admin, runtime, identity and migration URLs are derived automatically. The launcher uses `LOCAL_WEB_PORT`, `LOCAL_API_PORT`, `LOCAL_POSTGRES_PORT`, `LOCAL_APP_ORIGIN`; generic `APP_ORIGIN` alone does not override the launcher's default.
5. Open loopback `3000` (or selected port), login with email/Thai mobile, complete onboarding. API defaults to `3001`; PostgreSQL to `55433`.
6. Ctrl-C stops application processes. PostgreSQL/volume persists; `docker compose -f infra/compose.local.yaml stop` stops the DB service without deleting data.

The launcher generates client/applies migrations using admin credentials, gives runtime URLs to Nest and starts Next with an isolated environment. It does not reset local/QAS. Changing init passwords after a volume exists does not change database roles; use the database runbook for credential changes.

## Select a local database

Set these values in the root `.env.local`, then run `pnpm dev:local`:

```dotenv
DELEDGER_ENV=local
LOCAL_DATABASE_NAME=deledger_local_v2
LOCAL_POSTGRES_PORT=55433
LOCAL_POSTGRES_PASSWORD=deledger-local-postgres
LOCAL_WEB_PASSWORD=deledger-local-web
LOCAL_IDENTITY_PASSWORD=deledger-local-identity
```

Names must match `deledger_local` or `deledger_local_<suffix>` with lowercase letters/digits separated by underscores, at most 63 characters. This preserves a local namespace and rejects QAS (`deledger`), production and test database names. The API retains its `deledger_test` exception only under `NODE_ENV=test` with no explicit `LOCAL_DATABASE_NAME`.

Optional URL overrides are `LOCAL_ADMIN_DATABASE_URL` (`postgres`), `LOCAL_DATABASE_URL` (`deledger_web`) and `LOCAL_IDENTITY_DATABASE_URL` (`deledger_identity`). Each must name the selected database and all must use the same loopback host and port, without query parameters/fragments. Remove old fixed URLs from `.env.local` to use generated defaults. Generic `DATABASE_URL` and `MIGRATION_DATABASE_URL` do not override launcher or seed targets. Passwords used in generated URLs are URL-encoded automatically; quote shell-special characters in `.env.local`.

Compose uses the selected name for `POSTGRES_DB`, its healthcheck and the default volume `<LOCAL_DATABASE_NAME>_pgdata`. Stop the application processes before changing the name and launching again; Compose replaces the local DB container's mount while retaining the previous volume. No reset, volume deletion or data copying occurs. Switching back restores the original volume. `DELEDGER_LOCAL_PGDATA_VOLUME` remains an explicit advanced override; use it only for a volume already belonging to the selected database. Direct Compose commands should use `docker compose --env-file .env.local -f infra/compose.local.yaml ...` so the same configuration is loaded.

## Test accounting dates locally

After local sign-in, the system-date panel is available on application pages, including onboarding. Choose a date and acknowledge the warning, or use “กลับวันที่จริง” / “Return to real date”. The API permits dates within 24 calendar months of the real Bangkok date in either direction.

The selected date is shared by every User and the scheduler in this single local API process. Moving forward can close elapsed months and create following months in the existing local database. Moving back, resetting, or restarting the API does **not** undo those writes or reopen closed months. This is not a data sandbox. API restart clears only the in-memory date override.

Use the last day of a month to test Manual Close with complete, coherent inputs; use the first day of the next month to test Automatic Close with missing inputs. Session expiry, audit timestamps, operational health and birthday validation still use real time. Other tabs refresh the calendar on focus and every 30 seconds; stale financial forms must be reviewed before saving.

These controls are unavailable in QAS; direct clock changes return 404 there. Production startup remains unsupported. Do not change the machine clock or point test-reset scripts at the local database.

Historical onboarding can start up to 24 Reporting Months back, including the current month. History can prepend up to 24 earlier months per request, preserving existing supplied starting balances; complete past Income and Ending Balance through History. “เริ่มติดตามใหม่” / “Start fresh” is available only for an untouched current month with a missing inherited opening. It keeps earlier history and copied expense setup, and is separate from operator archive/restore.

## Demo data

In another terminal, after configuring `.env.local` from the example:

```bash
pnpm seed:local
```

Seed automatically reads the root `.env.local` and shares the launcher's URL generation and validation, accepting only a loopback `postgres` administrator URL for `LOCAL_DATABASE_NAME`. Synthetic identities/sample month live in [seed-local.mjs](../../scripts/seed-local.mjs); existing seeded Users are skipped. Seeding is optional.

Use `pnpm qc` and [QA guidance](../qa_testing/README.md). Stop local Next before E2E from the same checkout: different ports still share `.next/dev`. Use a separate checkout if development must continue.

QAS work follows the [deployment runbook](../../docs/operations/deploy-private-beta.md); local login is not a QAS fallback. Do not source QAS credentials to start a local application.
