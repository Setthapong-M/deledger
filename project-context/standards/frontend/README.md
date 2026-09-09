# Frontend standards

Use Next.js **App Router**, React and Tailwind CSS. Read installed Next documentation as required by [web/AGENTS.md](../../../web/AGENTS.md) before source edits.

- Pages live in `web/src/app/`; interactive components in `web/src/components/`. Keep browser interactions at the appropriate client boundary.
- Use [api-client.ts](../../../web/src/lib/api-client.ts) for same-origin requests/errors; align its types when backend contracts change.
- The catch-all route forwards to Nest through [server-api.ts](../../../web/src/lib/server-api.ts). Preserve cookies/auth forwarding and no-store semantics. Next receives `API_ORIGIN`, not database or Access verifier credentials.
- Render backend reconciliation/lifecycle/`allowedActions`. Keep authorization/accounting on the backend and distinguish provisional snapshots from confirmed Ending Balance.
- Keep money inputs textual; use existing money fields/formatters. Display formatting must not become floating-point accounting.
- Use `DateInput` for date controls: a shared in-flow calendar with localized month/year selection, keyboard navigation, today/clear actions and the shared calendar icon. Display Thai dates with Buddhist years and English dates with Gregorian years; pass ISO Gregorian values to forms/APIs. Required-date validation belongs to the owning form. `MoneyField` accepts clipboard amounts with validated comma grouping and optional THB/baht markers, strips presentation formatting without numeric conversion, and preserves selected-range replacement. Reject ambiguous separators, negatives, exponent notation and more than two decimal places rather than silently changing their value.

Reuse existing Tailwind tokens, `ui-styles.ts`, dialogs, controls and feedback. Preserve Thai/English copy, themes, responsive layouts, keyboard focus, dialog cancellation and accessible names. New UI/form libraries require an explicit dependency/design decision.

Use `useCopy` from `web/src/lib/i18n.tsx` with typed, colocated `Messages` for UI text, including accessible names and validation. Thai is the default; `deledger_locale` persists the explicit Thai/English choice and the root layout uses it for server rendering. Switching language must retain in-progress inputs. Keep raw API errors until rendering and localize their stable codes through `localized-error.ts`; never display untranslated server messages. Pass the active locale into month/date formatters. Money stays in THB and exact decimal strings; language changes do not translate user-entered names or change accounting.

Use short, concrete copy: Snapshot appears as “ยอดเงินระหว่างเดือน” / “Balance check-in”; Fixed as “ยอดคงที่” / “Fixed amount”. Preserve distinctions between estimated and confirmed totals, missing and zero, and itemized spending versus the total. Prefer familiar icons for repeated actions with localized accessible names and tooltips; keep visible text where an icon alone is ambiguous. Google Sans is loaded with Thai/Latin subsets through `next/font` and applied globally, including form controls.

Handle loading, empty/error, archive/resume and revision conflicts. Reconcile conflicts using current server results rather than silently overwriting. Dispose or ignore obsolete async responses so an older profile fetch cannot replace a newer edit/reload.

Use the shared `Icon` component in `web/src/components/icon.tsx` for interface icons rather than Unicode glyphs or ad-hoc SVGs. The set uses a 24×24 grid, 1.75-unit outline strokes, rounded caps/joins and soft square proportions. Keep directional symbols recognizable rather than forcing mirror symmetry. Icons inherit `currentColor`, remain decorative to assistive technology, and keep localized names on their owning controls. Preserve visible labels for navigation and ambiguous actions; the brand mark and timeline step numbers are not interface icons.

Verify interactions with component tests and integrated journeys with Playwright, including mobile WebKit for forms, dialogs and focus changes. See [testing](../../qa_testing/README.md).
