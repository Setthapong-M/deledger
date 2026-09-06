# Nest authentication and Prisma identity foundation

Status: resolved
Blocked by: None
Spec: ../spec.md

## What to build

Local login, invitation authentication and profile operations work through Nest and Prisma with exact existing contracts; schema/roles, RLS, isolated tests, same-kind replacement regression and frontend proxy are in place.

## Acceptance criteria

- [x] Behavior described above works end-to-end under the accepted spec.
- [x] Targeted behavior tests and typecheck pass.
- [x] No ordinary raw SQL or hidden legacy business-function dependency remains in the delivered path.
- [x] Preserve isolation and all applicable UI/API contracts.

## Execution

Integration branch permits independent module preparation in parallel; final green is required at the integrate-and-verify gate.

## Completion

Implemented and verified. See [final validation](../validation.md) and [independent review](../review.md). Full integration gate passed; no requested implementation item remains open. Existing local/QAS deployment is a separate cutover documented in operations guidance.
