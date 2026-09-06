# Complete Deledger stack migration

Status: implemented and verified
Source branch: diagnos-tech-stack
Baseline: 9264d45 plus preserved working diff
Execution: parallel implementation agents at independent module seams, integrated sequentially by the primary agent; shared schema/contracts fixed before dependent implementation. User delegates technical decisions and continuation, including test seams and ticket granularity.

## Problem Statement

Deledger's backend behavior is split across Next handlers, direct PostgreSQL access and stored functions. The selected stack must give NestJS full API/auth/business ownership and Prisma full schema/migration/access ownership without changing the existing financial workflow or latest UI.

## Solution

Keep the browser experience and /api contracts intact while replacing the internal backend and persistence. A fresh database is sufficient; local development and private beta remain separately deployable with their existing authentication boundaries.

## User Stories

1. As a User, I enter local email or Thai phone and continue as the same identity.
2. As a private-beta User, I enter through Cloudflare Access/WARP and invitation checks.
3. As a User, I can update permitted profile fields and retain at least one login contact.
4. As a User, I cannot read or mutate another User's data.
5. As a User, I start tracking with exact opening balance/income in a Partial Month.
6. As a User, I see Asia/Bangkok Reporting Months independent of browser timezone.
7. As a User, I enter money as decimal strings with exact cent arithmetic.
8. As a User, I record provisional Balance Snapshots without implicitly confirming Ending Balance.
9. As a User, I manage ordered monthly recurring setup, pauses and independent monthly copies.
10. As a User, I confirm/correct/cancel immutable name/type/amount snapshots of paid expenses.
11. As a User, I manually close only on the last Bangkok day with complete coherent inputs.
12. As a User, I get Automatic Close after calendar boundaries even with incomplete inputs.
13. As a User, I correct Closed Months and see next-month Starting Balance derived from confirmed facts.
14. As a User, I see Needs Information and Inconsistent Month distinctions preserved.
15. As a User, I receive a revision conflict with current Month View for stale writes.
16. As a User, failed operations leave no partial writes or revision increments.
17. As a User, I browse history and explicit Tracking Gaps using the current UI.
18. As an operator, I archive/restore Users without inferred balances across a Tracking Gap.
19. As a restored User, I resume with fresh supplied balances and independent setup snapshot.
20. As an operator, I invite/transfer identities and export encrypted facts including phone identity.
21. As an operator, I bootstrap clean Prisma databases and verify encrypted backup/restore.
22. As a developer, I run local and tests without touching private-beta data.
23. As an operator, I retain private ingress, least privilege, readiness and restart-safe scheduling.
24. As a User, I retain responsive layout, Tailwind styling, theme, focus and accessibility behavior.

## Implementation Decisions

- Next forwards unchanged API requests to internal Nest; Nest authenticates and owns all API envelopes/validation. No DB credentials or auth decisions in frontend.
- Explicit stable Nest 12.0.1 and Prisma CLI/client/pg adapter 7.10.0, ESM NodeNext build, existing frontend pins.
- Prisma models map the nine existing application table/column names. PostgreSQL numeric(15,2), dates and bigint preserve storage contracts; Decimal and BigInt serialize deliberately.
- Prisma owns a fresh initial migration with required checks, compound FKs, partial indexes, deferrable reorder uniqueness, RLS and grants. No legacy stored business functions or cron remain.
- Restricted per-User Prisma client uses transaction-local owner setting; privileged identity/operator/maintenance client is internal and receives only verified identity or operator invocation. All request work after verification shares one transaction and User lock; auth cannot trust request owner IDs.
- Every month write locks User before revision check. User-wide serialization also applies to archive/restore/catch-up. Only lock/session-setting SQL and migration-only unsupported database facilities are permitted exceptions, documented with tests.
- Nest owns read derivations, lifecycle, local sessions/profile, operator logic and periodic/startup/per-request catch-up. Pure helpers and injectable time are testable without database function rewriting.
- Fix one-pass multi-month catch-up and same-kind contact replacement; preserve closed detail API behavior, immediate-next affectedMonthKeys and history gap pagination. Physical restore validates all nine data tables; export excludes sessions.
- Local and QAS stay separate; prod remains unavailable. Reset must verify Deledger target. Test-only fresh DB is the initial destructive scope.

## Testing Decisions

- Real Nest HTTP + PostgreSQL is the primary observable seam for API/auth/month flows. Preserve existing assertions while relocating backend tests.
- Pure money/calendar/reconciliation tests preserve exact output and boundary cases.
- Database security seam tests ownerless/wrong-owner access, pooled context clearing, constraints, atomic rollback and parallel same-revision writes.
- Operator/scheduler service seam tests archive/resume, concurrent catch-up and profile identity races. External clock/JWKS may be controlled; do not mock Prisma/internal services to claim integration.
- Existing UI component/E2E assertions remain; run an unmocked login→onboard→write journey against both processes. Operations tests cover fresh deploy, network/credential boundaries and restore evidence.
- Run typecheck regularly; targeted tests per slice; full build and combined suite at integration gate. Treat inability to run a required check as incomplete verification, never a pass.

## Out of Scope

Legacy data/history preservation, stack reconsideration, UI redesign, public production/OTP, unrelated database resets, external deployment.

## Further Notes

Resolved decision tickets and research artifacts in this effort are supporting evidence. Runtime verification takes precedence over declared package compatibility. Keep every original working-tree change's intent through the migration. The spec is audited for full behavior inventory coverage, privilege boundaries, target safety, dependency order and concrete acceptance gates before application edits.

Audit: passed 2026-09-06 by primary agent; no unresolved decisions; user-authorized delegation covers seams and implementation breakdown. Local Markdown tracker explicitly overrides personal PARA storage conventions for this effort.

## Verification clarifications

Preserve valid derived totals even when the sum exceeds an individual input column's precision bound; continue to bound stored inputs. Preserve in-progress profile edits by discarding disposed initial requests; no UI layout or auth behavior changes. Login retries a concurrent new-contact unique conflict as a whole login transaction at most three times, separately from general P2034 retries. Runtime privileges retain append-only snapshots and immutable detail update restrictions in addition to RLS.
