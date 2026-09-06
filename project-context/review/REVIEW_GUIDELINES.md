# Review guidelines

Pin base/head commits and identify the requested behavior/spec. Evaluate standards and behavior separately; passing tests do not establish task completeness.

## Criteria

- Scope serves the request; no silently adopted stack or unrelated rewrite.
- Ownership remains Next presentation/proxy, Nest auth/business, Prisma persistence; review raw SQL/privileged seams.
- Money, Bangkok dates, close gates, corrections, setup/confirmation facts and Tracking Gaps match applicable ADRs.
- Verified owner, RLS/grants, locks, revisions and rollback survive concurrency/failure.
- Schemas, error/status envelopes, null/omitted semantics and frontend contracts agree; public routes do not expose financial data.
- Loading/conflicts/errors, themes, accessibility and responsive navigation preserve expected behavior.
- Config stays fail-closed; QAS ports, runtime roles/images and migration targets remain scoped.
- Evidence covers affected consumers; distinguish tested from inferred behavior. Docs match executable commands and router targets.

## Severity

| Level | Meaning | Example |
| --- | --- | --- |
| P0 | Immediate broad harm | Active cross-user disclosure or destructive accounting write |
| P1 | Major supported-flow defect | Auth bypass, data loss or materially wrong totals |
| P2 | Significant conditional defect | Stale-write race, migration upgrade failure, route collision |
| P3 | Localized maintenance/documentation issue | Broken context link, misleading command, duplicated convention |

Findings need source location, trigger, observed/expected behavior and correction. Separate confirmed defects from suggestions. Record accepted debt in [drift.md](drift.md); memory does not waive standards.

Done means findings are fixed or explicitly recorded with unresolved impact, required checks are accurately reported, and PR prose describes the final implementation. Earlier-commit CI success is not proof for a newer head.
