# UX/UI verification

Branch: dev-uxui
Date: 2026-09-05

## Scope

Presentation changes only. No changes to server, API client, database, financial calculations, auth handlers or allowedActions. The close request remains `{ expectedRevision }`. Primary colors remain #B5C69C (light) and #bbcca6 (dark).

Reference: the ingested Airbnb clone/research in `.scratch/airbnb-ux/`. Layout choices are Deledger adaptations, not verified Airbnb tokens or a pixel-identical copy.

## Results

| Check | Result |
| --- | --- |
| `pnpm qc` | Lint and typecheck passed |
| `pnpm build` | Production build passed |
| `pnpm test:unit` | 34 tests passed |
| `pnpm test:integration` | 43 tests passed |
| `pnpm test:ops` | 14 tests passed |
| `pnpm test:coverage` | 91 tests passed; configured coverage thresholds passed |
| `pnpm test:e2e` | 56 tests passed across Chromium, Firefox, WebKit and mobile WebKit |
| `git diff --check` | Passed |

Configured coverage scope: statements 95.83%, branches 91.85%, functions 97.5%, lines 99.17%. This is the repository's configured coverage subset, not coverage of the whole UI.

Browser coverage includes original auth/profile/onboarding/history journeys, light/dark axe checks, 320px no horizontal overflow, no editing without server permission, provisional labels, missing values, close review/cancel/Escape/focus restoration/request payload, separate Tracking Gap state, and bottom navigation clearance at the final action.

The existing login E2E assertion targeted `/`, an intermediate redirect. It now waits for `/start`, matching the existing onboarding-required flow; application login logic is unchanged.

## Visual review

Actual rendered pages with deterministic mocked API data, not real user records. Reviewed desktop and mobile in light/dark. Full-page mobile captures show the fixed navigation at the original viewport boundary; the rest of the page remains scrollable, and the bottom-clearance test verifies access to its last action.

- [Desktop light](screenshots/desktop-light.png)
- [Desktop dark](screenshots/desktop-dark.png)
- [Mobile light](screenshots/mobile-light.png)
- [Mobile dark](screenshots/mobile-dark.png)

## Environment and boundaries

WebKit initially could not launch because the host lacked GStreamer/AVIF dependencies. Public Ubuntu packages were extracted into the user's browser cache and linked only into Playwright's browser bundle; no application dependency or system package changes. The final normal `pnpm test:e2e` invocation passed.

Validation ran in the supplied working tree, which already had unrelated deployment and PostgreSQL test-harness edits. Those pre-existing changes were left intact and excluded from this UI commit: infra/compose.yaml, scripts/setup-private-beta.sh, web/Dockerfile, web/src/test/postgres.ts, web/tests/operations/deployment.integration.test.ts, web/tests/services/catch-up-history.integration.test.ts, web/tests/services/month-operations.integration.test.ts.

Human usability review is still required. Shared CSS affects multiple routes, so regression risk remains medium despite automated coverage. No deployment or merge into main was performed.

The generated `web/next-env.d.ts` started with dev-server type paths; the production build regenerated it to its tracked production type paths. It was not staged in the UI commit.

PR: https://github.com/Setthapong-M/deledger/pull/6 (dev-uxui → main), opened for review without merging.
