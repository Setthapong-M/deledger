# Tailwind CSS v4 migration

Date: 2026-09-05
Source task: dev-uxui
Source branch: dev-uxui
Predecessor: Deledger UX/UI overview refinement (PR #6)

> Execution: sequential in this session. Global styles, utilities and component class replacements must move together. User authorizes implementation and updating PR #6; never merge.

## Goal
ย้าย Vanilla CSS component selectors ไปใช้ Tailwind CSS v4 utilities โดยรักษาหน้าตา สี พฤติกรรมและ financial/domain logic จาก PR #6

## Decisions
| Area | Decision | Reason |
| --- | --- | --- |
| Build | Pin tailwindcss and @tailwindcss/postcss 4.3.3, postcss 8.5.28; PostCSS config in web/ | Official Next.js integration; reproducible lockfile |
| Tokens | CSS-first @theme inline maps existing light/dark runtime tokens to utilities | Preserve cookie/system theme behavior and primary colors |
| Breakpoints | mobile <=760px and tablet <=900px custom variants | Preserve exact inclusive layout boundaries |
| Utilities | Static utility strings in JSX; shared primitives in components/ui-styles.ts | Avoid legacy CSS selector layer and runtime class generation |
| States | Complete static variants driven by current ARIA/data state | Tailwind scanner can detect every class; no computed class names |
| Preflight | Standard Tailwind import plus explicit minimal base typography/form/focus rules | Keep existing browser-default rhythm and keyboard accessibility |

## Invariants
No changes to server, API, database, calculations, authorization, request bodies, financial values or form handlers. Existing unrelated dirty deployment/test files remain outside commits. No broad @apply conversion of legacy component selectors.

## Files
- EDIT web/package.json, pnpm-lock.yaml, web/src/app/globals.css
- NEW web/postcss.config.mjs, web/src/components/ui-styles.ts
- EDIT every existing styled component in web/src/components/ and page under web/src/app/ (only className/presentation attributes and imports)
- EDIT web/e2e/security-concurrency-accessibility.spec.ts: use real shared utility classes for the existing color probe
- EDIT local verification record and PR #6 description; refresh screenshots from actual UI

## Micro-tasks
- [x] Install pinned dependencies and configure PostCSS + CSS-first theme. Audit: actual v4 compiler, no Tailwind v3 config, all existing primary colors preserved.
- [x] Migrate component and page styling to static utilities with reusable primitives. Audit: no legacy styling selectors, runtime-generated utility names or handler changes; cover responsive, focus, disabled, selected, drag, paused and reconciliation states.
- [x] Run lint/typecheck/build, unit/integration/operations/coverage, all-browser E2E; inspect before/after light/dark and mobile screenshots. Audit: preserve supported routes, typography, geometry and state behavior.
- [ ] Commit only task-owned paths, push dev-uxui, update PR #6 title/body and evidence. Audit: PR remains open, no merge or auto-merge.

## Build check
pnpm qc; pnpm build; pnpm test:unit; pnpm test:integration; pnpm test:ops; pnpm test:coverage; pnpm test:e2e.

## Risk register
| Risk | Mitigation |
| --- | --- |
| Preflight changes defaults | Explicit base styles; compare screenshots with predecessor |
| Utility sorting changes compound states | ARIA/data variants, targeted hover/disabled checks and browser coverage |
| Scanner misses dynamic classes | Fully spelled class literals in source |
| Shared styles affect rarely visited pages | Existing journeys plus state checks and manual browser inspection |

## Plan audit
Passed against current component inventory, repo instructions, installed Next.js guide and official Tailwind v4 docs. No ambiguous product decisions. Repository-local planning continues the established .scratch convention.

Sources: https://tailwindcss.com/docs/installation/framework-guides/nextjs ; https://tailwindcss.com/docs/theme ; https://tailwindcss.com/docs/preflight ; https://tailwindcss.com/docs/detecting-classes-in-source-files
