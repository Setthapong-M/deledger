# Backend standards

## Boundaries

The existing path is Nest controller → Fetch-compatible route handler → service → Prisma repository/domain derivation. See [controller](../../../api/src/api.controller.ts), [route helper](../../../api/src/server/http/route-handler.ts) and [services](../../../api/src/server/services/).

- Controllers adapt HTTP/register routes; services/domain functions own decisions.
- Authenticated user routes use `handleUserRoute`, Zod input schemas and the shared response envelope. Login/mode/liveness have intentionally separate access boundaries; do not copy those into financial endpoints.
- Services and repositories use the supplied transaction client and verified owner. Opening another client inside a use case breaks atomicity.
- Keep derivations deterministic. Use the existing clock seam and Bangkok calendar helpers.

API code uses ESM/NodeNext and `.js` relative imports in TypeScript. Generate Prisma client during build/typecheck; generated files are not hand-edited or committed.

## HTTP and validation

Use [schemas.ts](../../../api/src/server/http/schemas.ts) and [profile-schema.ts](../../../api/src/server/http/profile-schema.ts). Reject invalid JSON, dates, unsupported fields and money; preserve shared origin/content-type checks for writes.

Responses are `{ data: ... }` or `{ error: { code, message, field, current } }`; statuses come from [envelope.ts](../../../api/src/server/http/envelope.ts). Preserve conflict payloads/revisions so clients can reconcile rather than overwrite. Register literal routes such as `months/current` before competing parameter routes.

## Accounting and background work

Use Prisma Decimal for arithmetic and decimal strings for transport; JavaScript `number` is not the accounting representation. `Monthly Spending = Starting Balance + Income - Ending Balance`; details explain that total. Missing inputs propagate unknown results to dependent months.

Read the accounting router route/ADRs before changing close gates, Closed Month corrections, provisional snapshots, setup copies or confirmation facts. Keep these rules in one backend implementation.

[scheduler.ts](../../../api/src/scheduler.ts) performs startup/periodic catch-up; requests also catch up under the User transaction. Preserve owner locking and repeatability under overlapping ticks/requests. No queue delivery semantics exist to assume.

Operator/identity work has intentionally broader visibility. Follow [database standards](database.md) and the [operator runbook](../../../docs/operations/operator-runbook.md), keeping privileged access at those seams.
