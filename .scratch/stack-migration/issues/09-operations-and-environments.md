# Run operator and private/local environments on the new stack

Status: resolved
Blocked by: 07, 08
Spec: ../spec.md

## What to build

Operator commands use Nest services/Prisma; scheduler and clean migrations replace SQL functions/cron. Local/QAS Compose, seed/dev scripts, backup/restore and readiness use the new topology and preserve target checks.

## Acceptance criteria

- [x] Behavior described above works end-to-end under the accepted spec.
- [x] Targeted behavior tests and typecheck pass.
- [x] No ordinary raw SQL or hidden legacy business-function dependency remains in the delivered path.
- [x] Preserve isolation and all applicable UI/API contracts.

## Execution

Integration branch permits independent module preparation in parallel; final green is required at the integrate-and-verify gate.

## Completion

Implemented and verified. See [final validation](../validation.md) and [independent review](../review.md). Full integration gate passed; no requested implementation item remains open. Existing local/QAS deployment is a separate cutover documented in operations guidance.
