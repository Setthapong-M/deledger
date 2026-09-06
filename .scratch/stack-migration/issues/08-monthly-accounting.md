# Move monthly accounting and lifecycle to Nest

Status: resolved
Blocked by: 07
Spec: ../spec.md

## What to build

All financial reads/writes, onboarding/resume, snapshots/setup/details, history, closed corrections, Manual/Automatic Close use Prisma and Nest business logic. Exact money, Bangkok, revisions, atomicity and one-pass catch-up are tested.

## Acceptance criteria

- [x] Behavior described above works end-to-end under the accepted spec.
- [x] Targeted behavior tests and typecheck pass.
- [x] No ordinary raw SQL or hidden legacy business-function dependency remains in the delivered path.
- [x] Preserve isolation and all applicable UI/API contracts.

## Execution

Integration branch permits independent module preparation in parallel; final green is required at the integrate-and-verify gate.

## Completion

Implemented and verified. See [final validation](../validation.md) and [independent review](../review.md). Full integration gate passed; no requested implementation item remains open. Existing local/QAS deployment is a separate cutover documented in operations guidance.
