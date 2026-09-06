# Module impact map

Select affected consumer routes as well as the owning module. Paths below are navigation aids; inspect actual references/tests before editing.

| Change area | Owning sources | Consumers / exposure | Evidence |
| --- | --- | --- | --- |
| Money/calendar | `api/src/server/domain/` | All month views, close, snapshots, history, continuity | `api/tests/domain/`, accounting integration |
| Close/correction/setup | `api/src/server/services/month-write.ts`, `catch-up.ts` in the same directory | Future balances, snapshots, reconciliation, scheduler | `api/tests/accounting.integration.test.ts`, `web/e2e/` |
| Archive/restore | `api/src/server/services/lifecycle.ts`, `api/src/operator.ts` | Access, resume opening, catch-up, gaps/history | Operations integration and lifecycle UI tests |
| Identity/profile | `api/src/server/auth/`, profile/local-auth services | All protected routes, local/QAS differences, sessions, contact claims | Identity, local-auth, QAS HTTP and profile component tests |
| Transactions/schema | `api/src/server/db/`, `api/prisma/`, `db/` | All user data, retries, privileges, migration/recovery | Database/HTTP integration and restore smoke |
| HTTP | `api/src/api.controller.ts`, `api/src/routes/`, `api/src/server/http/` | `web/src/lib/api-client.ts`, proxy, forms/errors | HTTP integration, API proxy and integrated E2E |
| UI | `web/src/components/`, `web/src/app/` | Navigation, theme, focus/mobile, reload/conflicts | Components, accessibility and Playwright projects |
| Configuration/images | `api/src/server/config.ts`, `web/src/instrumentation.ts`, `infra/`, Dockerfiles | Startup, networks, JWT, release scans | Config tests, container smoke, release checks |

Completion: name affected consumers in the task, test the risk boundary, and update this map when ownership/entry points move. Report unverified consumers through the [review guidelines](../review/REVIEW_GUIDELINES.md).
