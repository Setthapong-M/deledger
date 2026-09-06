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

Tests reset only `deledger_test` at loopback port 55432. Container/recovery smoke creates and cleans uniquely named isolated databases/networks/volumes. Existing local and private-beta databases and services were not reset or deployed. Their pre-migration volumes require the documented fresh-database cutover before running this new stack against them.

Existing frontend package pins retain upstream ESLint/TypeScript peer-range warnings. They were already present in the retained frontend toolchain; actual compiler, frontend build, browser and Nest runtime checks pass. No prerelease Prisma tag was installed.

Full execution logs for this run are available locally at `/tmp/deledger-full-tests-final.log`, `/tmp/deledger-migration-target-regression.log`, `/tmp/deledger-production-build-final.log`, and `/tmp/deledger-containers-final.log`. The checked-in commands above reproduce the gates without relying on those temporary logs.
