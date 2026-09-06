# Move Deledger to Next.js, NestJS, Prisma and PostgreSQL

Label: wayfinder:map
Status: complete

## Destination

Clear the decisions needed for a complete, behavior-preserving migration of Deledger to Next.js frontend, NestJS API/authentication/business logic, and Prisma-owned PostgreSQL schema, migrations and access. Hand the linked decisions to `/to-spec`, then `/to-tickets`, then `/implement` within this effort; a prototype or partial migration does not complete the effort.

## Notes

- Source worktree: `/home/admin/vault/deledger`; branch `diagnos-tech-stack`; inspected HEAD `9264d45` on 2026-09-06. Eight pre-existing tracked modifications must be preserved. See [working-tree baseline](baseline.md).
- User has already confirmed the stack and ownership above. Preserve the latest UI/Tailwind, exact money, Asia/Bangkok dates, distinct Manual/Automatic Close gates, correctable Closed Months and downstream effects, Balance Snapshots, Monthly Expense Setup and confirmation snapshots, archive/restore/Tracking Gap, revision conflicts, atomicity and User isolation.
- Existing data and migration history need not survive. A fresh database is authorized only after verifying the actual target belongs to the in-scope Deledger environment. Local login and Cloudflare Access/WARP private beta boundaries and environment separation remain. Public production/OTP are not authorized.
- Raw SQL is permitted for necessary PostgreSQL facilities such as RLS and locking, with documented reasons and tests. Ordinary access belongs to Prisma; business rules currently in database functions belong to NestJS.
- Read `AGENTS.md`, `docs/agents/issue-tracker.md`, `CONTEXT.md`, relevant ADRs and current implementation/tests together. Earlier specs do not fully describe local identity/profile.
- Skills: wayfinder, grilling, domain-modeling; research for external facts. Once decisions clear, to-spec → to-tickets → implement (TDD and code-review). Decision tickets are not implementation tickets.
- User explicitly authorized continued execution and agent-owned decisions on 2026-09-06, overriding per-session pauses and HITL confirmation gates. Preserve core business logic; complete spec → tickets → implementation in this effort.
- The prior `.scratch/tech-stack/` assessment, official-sources notes and templates were not present in this checkout on inspection. Do not infer their contents or re-open stack selection.

## Decisions so far

- [Verify supported versions and Prisma PostgreSQL constraints](issues/01-version-compatibility.md): published metadata and versioned docs support a pinned stable Prisma 7/Nest 12 candidate; generated-client/build/runtime verification remains necessary.

- [Inventory current behavior and choose preservation tests](issues/02-behavior-inventory.md): source-cited API/domain/auth/operator/database coverage and test gaps are recorded; newly exposed behavior discrepancies require an explicit preservation/correction decision.

- [Settle Next-to-Nest routing and authentication boundaries](issues/03-topology-authentication.md): resolved under delegated authority; answer records the implementation contract.
- [Settle Prisma transactions and Nest-owned month lifecycle](issues/04-transactions-and-scheduling.md): resolved under delegated authority; answer records the implementation contract.
- [Decide preservation versus correction for existing inconsistencies](issues/06-parity-discrepancies.md): resolved under delegated authority; answer records the implementation contract.
- [Settle fresh-database cutover and full-system acceptance](issues/05-cutover-and-completion.md): resolved under delegated authority; answer records the implementation contract.

## Not yet specified

None. Continue through the [build specification](spec.md) and implementation tickets numbered from 07.

## Out of scope

- Reconsidering the already-selected stack, redesigning the UI, introducing new financial behavior, preserving legacy data/migration history, public production/OTP, and resetting unrelated databases.

## Delivery

The specification and implementation tickets are complete. [Validation](validation.md) records passing builds, tests, browser runs, real recovery/container smoke and [review resolution](review.md). Source migration is complete; existing running local/QAS services were not deployed or reset.
