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
                       PostgreSQL + pg_cron (db)
```

The web server owns HTTP parsing and authentication, service modules own atomic use cases, repositories own SQL, and domain modules derive the complete Month View. PostgreSQL forced RLS is the final User-isolation boundary.

## Development prerequisites

- Node.js `22.23.1`
- pnpm `11.1.3`
- Docker Engine `29.2.1` and Docker Compose `5.0.2`
- GitHub CLI for the requested branch/PR workflow

Copy `.env.example` for local operator configuration. Use `.env.test.example` only with the disposable loopback test database. Never commit either file with real values.

## Commands

```bash
pnpm install
pnpm dev
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

The private-beta wizard is intentionally operator-driven: it does not capture the
offline age private key, does not make Cloudflare policy changes automatically,
and stops before readiness when the off-device backup mount is absent. Run it only
on the host that owns the production Docker stack, with `ENV_FILE` pointing to a
mode-600 file outside version control.

## Project documents

- [Domain context](CONTEXT.md)
- [Executable specification](.scratch/deledger-online-mvp/spec.md)
- [Implementation plan](.scratch/deledger-online-mvp/implementation-plan.md)
- [Private deployment runbook](docs/operations/deploy-private-beta.md)
