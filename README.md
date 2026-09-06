# Deledger

Deledger is an invite-only monthly income-and-expense accounting app. It calculates monthly spending from aggregate balance inputs so a User can understand the month without reconstructing every transaction.

## Private Beta boundary

The MVP runs locally behind Cloudflare Private WARP and Cloudflare Access Email OTP. There is no public hostname, self-registration, bank integration, credit-card cycle, or ordinary permanent deletion. Only explicitly invited emails can reach the application.

## Architecture

```text
Cloudflare One Client (WARP)
          |
Cloudflare Access Email OTP
          |
Named Cloudflare Tunnel -> Next.js App Router (web)
                              |
                       NestJS API (api)
                              |
                       Prisma → PostgreSQL (db)
```

Next.js owns the UI and forwards API requests to NestJS. NestJS owns authentication, atomic use cases, domain derivations and restart-safe calendar scheduling. Prisma owns schema, migrations and all data access. PostgreSQL forced RLS is the final User-isolation boundary.

## Development prerequisites

- Node.js `22.23.1`
- pnpm `11.1.3`
- Docker Engine `29.2.1` and Docker Compose `5.0.2`
- GitHub CLI for the requested branch/PR workflow

Copy `.env.example` for QAS operator configuration and `.env.local.example` for local development. Use `.env.test.example` only with the disposable loopback test database. Never commit either file with real values.

## Commands

```bash
pnpm install
pnpm dev
pnpm dev:local
pnpm seed:local
pnpm qc
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:ops
pnpm test:coverage
pnpm test:all
pnpm verify:release
# First-host activation wizard (pauses for Cloudflare/WARP and secret custody)
ENV_FILE=.env ./scripts/setup-private-beta.sh
```

`test:integration`, `test:ops`, and `test:coverage` create and remove the disposable loopback PostgreSQL stack automatically. Browser tests use local fixtures and never call Cloudflare or production data.

For local development without Cloudflare, copy `.env.local.example` to a local env file or run `pnpm dev:local`. The command starts only the dedicated local PostgreSQL Compose service on port `55433`, runs migrations with the database administrator connection, and starts Next.js on `http://127.0.0.1:3000` and NestJS on loopback port `3001`. The local login accepts one email or Thai mobile number and does not request a password or OTP. Local data uses its own volume and network; the QAS stack remains under `infra/compose.yaml`.

To load deterministic demo Users without touching QAS or the disposable test database, load the local environment and run `pnpm seed:local`:

```bash
set -a; source .env.local; set +a
pnpm seed:local
```

The seed creates an email-only User, a phone-only User and a linked User with a sample Reconciled Month. It is safe to rerun: existing seeded Users are left unchanged, and the command refuses non-local administrator database targets.

The private-beta wizard is intentionally operator-driven: it does not capture the
offline age private key, does not make Cloudflare policy changes automatically,
and preserves the configured backup policy (`disabled` for the current beta). Run it only
on the host that owns the production Docker stack, with `ENV_FILE` pointing to a
mode-600 file outside version control.

## Project documents

- [Domain context](CONTEXT.md)
- [Executable specification](.scratch/deledger-online-mvp/spec.md)
- [Implementation plan](.scratch/deledger-online-mvp/implementation-plan.md)
- [Private deployment runbook](docs/operations/deploy-private-beta.md)

Next.js receives only `API_ORIGIN`; database and Cloudflare credentials belong to NestJS. QAS has no published ports: Tunnel → Next on the edge network, Next → Nest on the internal app network, Nest → PostgreSQL on the internal data network. `DATABASE_URL` uses `deledger_web`; `IDENTITY_DATABASE_URL` uses the scoped `deledger_identity` role. Only migration/backup operations use the PostgreSQL administrator.

The Prisma migration starts a fresh database. Existing legacy volumes are not compatible with this initial migration: inspect the Compose project, database name and volume first, and explicitly authorize replacement of the intended Deledger environment. The scripts automatically reset only the disposable loopback `deledger_test` database. They never reset local or QAS data.

Nest alone joins the non-internal `api-egress` network to fetch Cloudflare JWKS over HTTPS. This network publishes no host ports and does not join the Tunnel or frontend; inbound application traffic continues through Tunnel → Next → Nest. The app and data networks remain internal.
