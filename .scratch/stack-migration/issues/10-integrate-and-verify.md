# Verify full migration and retire legacy backend

Status: resolved
Blocked by: 07, 08, 09
Spec: ../spec.md

## What to build

Remove legacy backend runtime and SQL business paths; preserve UI behavior; pass build/typecheck/unit/integration/E2E/operations with fresh Prisma migration and full parity/security coverage; review Standards and Spec and resolve findings.

## Acceptance criteria

- [x] Behavior described above works end-to-end under the accepted spec.
- [x] Targeted behavior tests and typecheck pass.
- [x] No ordinary raw SQL or hidden legacy business-function dependency remains in the delivered path.
- [x] Preserve isolation and all applicable UI/API contracts.

## Execution

Integration branch permits independent module preparation in parallel; final green is required at the integrate-and-verify gate.

## Completion

Implemented and verified. See [final validation](../validation.md) and [independent review](../review.md). Full integration gate passed; no requested implementation item remains open. Existing local/QAS deployment is a separate cutover documented in operations guidance.
