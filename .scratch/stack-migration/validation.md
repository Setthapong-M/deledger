# Migration validation

Date: 2026-09-06
Branch: diagnos-tech-stack
Baseline: 9264d45 plus the preserved initial working-tree patch

## Completed gates

| Gate | Result |
| --- | --- |
| `pnpm lint` | Pass; inherited repository ESLint configuration excludes TS/TSX; compiler and review provide the TypeScript gate |
| `pnpm typecheck` | Pass: Prisma generation, API NodeNext compiler, Next route type generation and frontend compiler |
| `pnpm build` | Pass: generated Prisma client, compiled Nest application, optimized Next standalone build |
| `pnpm test:all` | Pass, including all gates below |
| Unit | Frontend 18 tests; API domain/auth 23 tests |
| PostgreSQL integration | 64 tests in 13 files; no skips; real HTTP, Prisma, RLS, transactions, accounting, identity and operator coverage |
| Browser E2E | 72 tests across Chromium, Firefox, WebKit and mobile WebKit, including unmocked Next→Nest→PostgreSQL journey |
| Operations | 6 tests plus actual encrypted dump/checksum/decrypt/isolated restore, migration state, nine tables, forced RLS and row counts |
| Backend domain coverage | 98.75% statements, 96.92% branches, 100% functions, 100% lines |
| Existing frontend coverage boundary | 95.58% statements, 94.82% branches, 95.65% functions, 98.21% lines |
| Docker | Built Next, Nest and migration images; plain PostgreSQL and backup images exercised |
| Compiled-container smoke | Pass: isolated fresh database, all three Prisma migrations, compiled operator, Next proxy, actual signed JWT/JWKS, authenticated Prisma/scheduler readiness; no host ports |
| Migration target override regression | Pass: all 64 integration tests with an inherited `MIGRATION_DATABASE_URL` deliberately pointing to loopback port 1 /not_deledger; scripts force the verified test target |
| Review | Standards and Spec reviewers rechecked all four findings; none unresolved |
| Diff hygiene | `git diff --check` pass; no generated Prisma client, private environment or runtime credentials staged |

The initial mobile failure was reproduced as a deterministic stale-profile-response component failure, fixed by discarding the disposed effect response, then passed three mobile repeats and the full browser suite. The initial /months/current Nest route collision was reproduced by a real HTTP regression before its fix. Regression evidence also covers maximum derived money, contact replacement, login/profile claims, deadlock retry and narrow runtime privileges.

Tests reset only `deledger_test` at loopback port 55432. Container/recovery smoke creates and cleans uniquely named isolated databases/networks/volumes. At this initial validation gate, existing local and private-beta databases and services had not been reset or deployed. The subsequently authorized cutover is recorded below.

Existing frontend package pins retain upstream ESLint/TypeScript peer-range warnings. They were already present in the retained frontend toolchain; actual compiler, frontend build, browser and Nest runtime checks pass. No prerelease Prisma tag was installed.

Full execution logs for this run are available locally at `/tmp/deledger-full-tests-final.log`, `/tmp/deledger-migration-target-regression.log`, `/tmp/deledger-production-build-final.log`, and `/tmp/deledger-containers-final.log`. The checked-in commands above reproduce the gates without relying on those temporary logs.

## Authorized local and QAS cutover

The user explicitly authorized resetting both databases and continuing through a PR to main. Before deletion, Docker project/container/volume metadata and `current_database()` verified `deledger_local` on `deledger_local_pgdata` (loopback 55433) and QAS `deledger` on `deledger_pgdata` (unpublished). Only these two volumes were replaced.

Both databases now have all three Prisma migrations, nine forced-RLS application tables, zero public database functions and zero application users. The local smoke account was removed after login → onboarding with decimal balances → current month → authenticated readiness → logout passed. QAS requires new operator invitations after the reset.

QAS PostgreSQL, Next and Nest are healthy; Cloudflare registered four tunnel connections. Next proxy liveness/mode and missing-token rejection passed. A separate internal Nest process completed Prisma/scheduler readiness, and the deployed API fetched real Cloudflare JWKS successfully. A real user's post-reset WARP/Access sign-in was not exercised because this session has no user Access token; signed identity authentication remains covered by integration and compiled-container tests.

The old cached migration image was initially selected by a plain Compose build because the migration service uses the operations profile. That attempt failed and rolled back; the migration image was explicitly rebuilt, the QAS volume replaced again, and all Prisma migrations succeeded. The deployment runbook already specifies `run --rm --build migrate`.

Release verification with the actual QAS environment exposed inherited Cloudflare variables in the E2E subprocess. `scripts/test-e2e.mjs` now clears team, audience and tunnel-token variables before starting its isolated local test servers. The release rerun uses the same QAS environment to verify this correction.

Runtime credentials remain outside Git. PostgreSQL/web passwords were retained and a new identity password configured in a private operator-owned secret directory. No backup mode or Cloudflare policy changes were made.

The release image scan also found a host-source directory with mode 0700 copied as root into the API image, followed by example credential URLs in bundled Prisma development source maps. The final API Dockerfile uses a separate production stage containing production dependencies, compiled code and Prisma migration files, with compiled artifacts owned by UID/GID 1001. Dependency source maps are excluded from that stage; Prisma's automatically installed peers otherwise retain the upstream example maps even with a production install. No application source or tests are copied into the runtime stage.

Final gates passed: live database/config/network checks and the complete lint/typecheck/build/test suite ran with the QAS environment. After the Docker-only correction, the unchanged image-gate section of `scripts/verify-release.sh` was rerun separately and printed `release checks passed`; compiled-container smoke passed against the final deployed API/Next/migration images. This was not a single uninterrupted release-script run. Logs: `/tmp/deledger-live-release-check.log`, `/tmp/deledger-release-image-gates.log`, `/tmp/deledger-final-container-smoke.log`. Local dev was restarted on loopback port 3000 and QAS uses the final healthy API image.
