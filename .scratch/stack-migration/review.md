# Migration review

Fixed point: `9264d45`; review includes staged and working implementation with `git diff 9264d45 -- .`. No intermediate source commits. Spec: [Complete Deledger stack migration](spec.md). Independent reviewers inspected Standards and Spec separately.

## Standards

No documented-standard violations found. Two P3 heuristic findings:

- Possible Duplicated Code: Manual Close repeated the Monthly Spending formula already available in its projection.
- Possible Duplicated Code: operator restoration repeated Bangkok date extraction instead of sharing the domain calendar helper.

Resolution: Manual Close now consumes projection.monthlySpending. businessDate(instant) supplies both currentBusinessDate() and restore boundary comparison. Independent focused recheck: both resolved, no unresolved findings.

## Spec

Two P2 findings:

- Broad runtime table grants regressed append-only Snapshot and immutable detail operation boundaries despite RLS owner isolation.
- Login racing a newly claimed profile contact could return P2002/HTTP500 instead of resolving the winning existing User.

Resolution: Prisma migration 03 revokes broad grants and grants each runtime table only needed operations. Negative real-database tests prohibit Snapshot update/delete and detail update. The login-only transaction wrapper retries P2002 at most three complete attempts; a deterministic uncommitted-profile-claim test proves retry resolves the existing User. Independent focused recheck: both resolved, no unresolved findings.

## Verification-discovered regressions

- Nest route ordering initially treated /months/current as a dynamic month key. An actual HTTP regression test and unmocked browser journey failed before ordering correction and pass afterward.
- Valid maximum inputs can produce derived money above the input precision limit. The derived Decimal mapping preserves these correct totals without loosening input validation.
- A disposed initial profile request could overwrite edited fields in development StrictMode. A deterministic component test failed before effect cleanup; afterward it passes and the unmocked mobile journey passed three consecutive runs. UI layout and business behavior remain unchanged.

Final execution evidence is recorded separately in validation.md. Reviews are source inspection, not a substitute for running tests.
