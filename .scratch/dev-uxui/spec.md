# Deledger: a calmer monthly overview

Date: 2026-09-05
Source task: dev-uxui
Source branch: dev-uxui

> Execution: sequential implementation with checkpoints. Shared CSS and components require a single coordinated pass. User authorizes design decisions, testing and PR creation; never merge.

## Goal
ปรับ presentation จาก reference ที่ ingest แล้วใน `.scratch/airbnb-ux/` ให้เห็นเดือน ยอดสำคัญ และสิ่งที่ทำต่อได้ชัดเจน คงสีหลักและ business logic ของ Deledger

## Invariants
- Keep primary colors #B5C69C / #bbcca6 and existing theme selection.
- No server, API client, database, calculation, auth or permission changes.
- Render server-provided amounts and allowedActions; never calculate money in the UI.
- Distinguish provisional spending, Ending Balance, closed lifecycle and reconciliation.
- Tracking Gap is a suspended interval, not Needs Information.
- Preserve all pre-existing dirty deployment/test files; stage only this task's files.

## Decisions
| Area | Decision | Reason |
| --- | --- | --- |
| Reference | Adapt hierarchy, rounded cards, segmented navigation and review sections | Ingested clone has no verified token values; do not claim official Airbnb fidelity |
| Shell | Desktop centered capsule navigation; fixed three-destination mobile bottom bar with safe-area clearance; skip link | Stable destinations, reachable controls and keyboard access |
| Month | Spending hero and disclosure of calculation; three input totals; two-column overview and input timeline on desktop | Prioritize total without hiding reliability or actions |
| Details | Existing confirmation chips and setup kept below overview; clearer explanatory copy | Details explain spending rather than adding to it |
| Closing | Reuse existing accessible Dialog with review amounts and status | Preserve close handler/gate, add keyboard and factual review |
| History | Flat month collection, Thai status labels, dedicated gap presentation, provisional spending label | Clear selected context without implying gaps need repair |
| Responsive | Single-column narrow layouts, wrapping headings, 44px targets, dark/forced-colors support | No clipping or obscured controls |

## Files to change
EDIT: web/src/app/globals.css, web/src/app/month/page.tsx, web/src/app/history/page.tsx, web/src/app/profile/page.tsx
EDIT: web/src/components/app-shell.tsx, web/src/components/navigation.tsx, web/src/components/month-summary.tsx, web/src/components/month-timeline.tsx, web/src/components/expense-chips.tsx, web/src/components/history-explorer.tsx, web/src/components/status-badge.tsx
EDIT: web/e2e/local-auth-profile.spec.ts
NEW: web/e2e/uxui.spec.ts
13 implementation/test files total, plus this specification and final verification record.

## Micro-tasks
- [x] Refine shared visual system and navigation. Audit: keep theme tokens, route/auth handlers and meaningful text labels; verify mobile safe area and overflow.
- [x] Restructure month summary and timeline presentation, add calculation disclosure and close review using existing Dialog. Audit: all financial values from view.summary; all mutations and allowedActions unchanged.
- [x] Refine history and supporting page copy. Audit: provisional spending labeled, gap has no reconciliation badge, history selection/refresh unchanged.
- [x] Add browser regression coverage for estimate/confirmed/missing amounts, close review/cancel/confirmation, permissions, history gap, responsive and dark accessibility. Audit: verify user behavior and request payloads rather than CSS implementation.
- [x] Run quality checks, production build, unit, integration, E2E and available operations/coverage suites. Capture desktop/mobile review screenshots. Audit: report exact failures/limitations and leave unrelated work untouched.
- [x] Review diff, commit only task-owned files, push dev-uxui and open PR targeting main. Audit: no merge; include reference basis, scope and validation evidence.

## Build check
`pnpm qc`, `pnpm build`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:ops`, `pnpm test:coverage`.

## Risk register
| Risk | Mitigation |
| --- | --- |
| UI implies an estimate is final | Explicit provisional labels and Snapshot explanation |
| Bottom bar obscures content | Reserved padding and safe-area inset; narrow viewport checks |
| Shared CSS regresses forms | Existing E2E, keyboard, axe and screenshot review in both themes |
| Existing dirty work enters commit | Explicit file allowlist; final status compared to initial snapshot |

## Out of scope
Domain rules, migrations, new dependencies, deployment, remote Figma edits, Airbnb branding, merging to main.

## Plan audit
Passed: requirements resolved under user's design delegation; scope matches repository/ADRs; reference limitations recorded; validation and PR authorized. Repo-local spec follows AGENTS.md issue-tracker convention instead of CRM-specific PARA setup. Implementation is sequential in this session.
