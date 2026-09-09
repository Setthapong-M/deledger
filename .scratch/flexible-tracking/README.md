# Flexible tracking — work index

Date: 2026-09-09
Source: dev-uxui at 0b8bd69, with existing uncommitted UX work preserved
State: all four tickets implemented and verified; local app running. See [implementation evidence](validation.md).

## Scope

[Specification](spec.md): local-only accounting-date simulation, historical starts for new/existing Users, and independent current-month Tracking Restart. No early-close override; use the existing local database with explicit no-rollback warnings.

User approved the four-ticket breakdown and API/PostgreSQL plus browser verification boundary during this task. Technical defaults are recorded explicitly in the spec rather than left for the implementing agent to infer.

## Execution order

| Ticket | Deliverable | Blocked by |
| --- | --- | --- |
| [01](issues/01-local-calendar-simulation.md) | Local date control, security, shared date and backward/reset behavior | None |
| [02](issues/02-historical-onboarding.md) | Historical onboarding and usable History summary correction | 01 |
| [03](issues/03-prepend-history.md) | Prepend history while preserving existing supplied balances | 02 |
| [04](issues/04-restart-tracking.md) | Restart an untouched current month independently of missing past inputs | 02 |

Implement sequentially 01 → 02 → 03 → 04 to avoid concurrent edits to shared lifecycle, History, API-client and date components. The genuine dependency edges permit 03 and 04 to be independent after 02; parallel execution still needs explicit file ownership coordination.

Implementation used explicit backend/frontend file ownership to avoid overlap, followed by integrated verification and independent Standards/Spec review. Completed acceptance and runtime evidence are recorded in the tickets and [validation](validation.md). This is a local implementation, not a deployment.

## Source anchors

- [Domain glossary](../../CONTEXT.md), [ADR 0009](../../docs/adr/0009-separate-clock-simulation-from-tracking-restarts.md)
- [Lifecycle service](../../api/src/server/services/lifecycle.ts), [catch-up](../../api/src/server/services/catch-up.ts), [scheduler](../../api/src/scheduler.ts)
- [Transaction boundary](../../api/src/server/db/transaction.ts), [clock seam](../../api/src/server/domain/clock.ts), [calendar helpers](../../api/src/server/domain/calendar.ts)
- [Month derivation and current selection](../../api/src/server/repositories/months.ts), [History service](../../api/src/server/services/history.ts), [financial writes](../../api/src/server/services/month-write.ts)
- [HTTP input schemas](../../api/src/server/http/schemas.ts), [route envelope/auth boundary](../../api/src/server/http/route-handler.ts), [Prisma schema](../../api/prisma/schema.prisma)
- [Current month UI](../../web/src/app/month/page.tsx), [History UI](../../web/src/components/history-explorer.tsx), [lifecycle form](../../web/src/components/lifecycle-form.tsx), [date input](../../web/src/components/date-input.tsx)
- [QA gates and isolation](../../project-context/qa_testing/README.md), [local database selection](../../project-context/guides_flows/development.md)

## Verification of this handoff

The publication audit checks local links, ticket dependency integrity, required sections, acceptance criteria and consistency with the recorded close/segment decisions. Runtime gates belong to implementation; no database reset, clock change, commit, push or deployment is authorized by a historical test command in this document.
