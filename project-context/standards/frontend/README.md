# Frontend standards

Use Next.js **App Router**, React and Tailwind CSS. Read installed Next documentation as required by [web/AGENTS.md](../../../web/AGENTS.md) before source edits.

- Pages live in `web/src/app/`; interactive components in `web/src/components/`. Keep browser interactions at the appropriate client boundary.
- Use [api-client.ts](../../../web/src/lib/api-client.ts) for same-origin requests/errors; align its types when backend contracts change.
- The catch-all route forwards to Nest through [server-api.ts](../../../web/src/lib/server-api.ts). Preserve cookies/auth forwarding and no-store semantics. Next receives `API_ORIGIN`, not database or Access verifier credentials.
- Render backend reconciliation/lifecycle/`allowedActions`. Keep authorization/accounting on the backend and distinguish provisional snapshots from confirmed Ending Balance.
- Keep money inputs textual; use existing money fields/formatters. Display formatting must not become floating-point accounting.

Reuse existing Tailwind tokens, `ui-styles.ts`, dialogs, controls and feedback. Preserve Thai labels, themes, responsive layouts, keyboard focus, dialog cancellation and accessible names. New UI/form libraries require an explicit dependency/design decision.

Handle loading, empty/error, archive/resume and revision conflicts. Reconcile conflicts using current server results rather than silently overwriting. Dispose or ignore obsolete async responses so an older profile fetch cannot replace a newer edit/reload.

Verify interactions with component tests and integrated journeys with Playwright, including mobile WebKit for forms, dialogs and focus changes. See [testing](../../qa_testing/README.md).
