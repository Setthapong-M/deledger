# QA and testing

Verify behavior at its risk boundary, not a copy of implementation. Commands belong to [package.json](../../package.json); exact CI stages belong to [ci.yml](../../.github/workflows/ci.yml).

| Gate | Command | Evidence |
| --- | --- | --- |
| Static | `pnpm qc`, `pnpm typecheck` | API/frontend compilation and type generation; lint limitation below |
| Build | `pnpm build` | Generated client, compiled Nest, Next production build |
| Unit | `pnpm test:unit` | Domain/auth primitives and selected frontend units |
| PostgreSQL | `pnpm test:integration` | Prisma/RLS, identity, real HTTP, revisions, accounting, rollback |
| Component/coverage | `pnpm test:coverage` | Backend coverage and frontend Vitest projects including components |
| Browser | `pnpm test:e2e` | Chromium, Firefox, WebKit, mobile WebKit; fixtures plus unmocked Next→Nest→PostgreSQL journey |
| Operations | `pnpm test:ops` | Operations tests and encrypted backup/restore checks |
| Full suite | `pnpm test:all` | All above test stages sequentially |
| Containers | `bash scripts/test-stack-containers.sh` | Built-image migration/operator/JWT/Prisma/readiness smoke |
| Release | `pnpm verify:release` | Operator-configured QAS checks, suite, image scans |

Container smoke requires prebuilt images; inspect `DELEDGER_SMOKE_*_IMAGE` defaults or pass actual tags. It does not build them. Release checks need the operator environment and running QAS; they are not a default fresh-clone command.

## Isolation

Wrappers reset/create/remove only disposable `deledger_test` on loopback `55432`; run serially because they share DB/Compose state. Never substitute local/QAS URLs to pass tests. E2E uses `3014`/`3015`; stop local Next dev in the same checkout first. Inspect wrappers before inheriting a runtime environment.

Use synthetic Users, explicit clocks and deterministic fixtures. Test with runtime roles: admin-only queries do not prove RLS. Include two-User isolation, failure after an intermediate write and whole-transaction retries without escaping partial writes.

## Behavioral boundaries

- Money: exact decimals, zero/missing inputs, maximum inputs and larger derived totals.
- Calendar: Bangkok boundary, final-day Manual Close, incomplete Automatic Close, restart/multi-month catch-up.
- Corrections: downstream continuity, provisional snapshots, independent setup/confirmation facts.
- Lifecycle: archive across boundaries, Tracking Gap and resume opening.
- Identity: local sessions/contact claims, signed QAS JWT, uninvited/archived users, forged headers, profile conflicts.
- UI: loading/error/conflict, stale responses, keyboard focus, accessibility, themes and mobile.

`web/eslint.config.mjs` ignores TS/TSX; report this rather than treating lint as TypeScript review. Coverage thresholds belong to Vitest configs, not historical percentages.

Report exact commands/outcomes and gaps. Fixtures do not prove persistence; local signed JWKS tests do not prove a real User's WARP enrollment. Documentation-only edits need links, YAML routing and reference checks, not DB resets/full app suites.
