# Wayfinder: Online Deledger MVP

Label: `wayfinder:map`
Status: resolved

## Destination

A complete decision map for an online, multi-user Deledger MVP that is clear enough to collapse into a buildable spec with `/to-spec`, without re-deciding product behavior or foundational architecture.

## Notes

- Deledger is a responsive online web platform for private personal financial records; the first release may be a private beta, but each User's data must be isolated from every other User.
- Each User owns one Financial Boundary represented by one aggregate balance. Underlying bank accounts, Internal Transfers, and bank integrations are not modeled.
- The confirmed stack path is one locally hosted Next.js application with open-source PostgreSQL, reached only as a Cloudflare private Access application through the Cloudflare One Client and a named Tunnel. PostgreSQL is never exposed to the network.
- Cloudflare Email OTP and exact-email invites are the sole MVP identity boundary. Deledger has no self-registration, password, profile, or administration UI; the operator performs invites, revocation, restoration, export, and verified identity transfer manually.
- The private beta is best effort with no SLA. It accepts a 24-hour recovery point using daily encrypted off-device backups retained for 30 days, and missed calendar work catches up idempotently after downtime.
- All Reporting Month boundaries use Asia/Bangkok regardless of User device location.
- MVP currency is Thai baht only.
- Monthly Spending is derived from Starting Balance + Income − Ending Balance. Monthly Expense Details only explain the derived total and are never added to it.
- A User may record Balance Snapshots throughout an Open Month. Ending Balance requires explicit confirmation.
- The first Reporting Month may be a Partial Month beginning on signup day. Income is one aggregate monthly amount.
- An Archived User loses access immediately but keeps all financial records indefinitely. Tracking stops after the last Open Month closes; restoration after a Tracking Gap starts a new Partial Month without inventing gap months or inferring balance continuity.
- A Reporting Month closes manually or automatically. A Closed Month remains correctable; missing required input yields Needs Information, and later corrections recalculate dependent months.
- Monthly Expense Setup is month-owned and ordered. A new Reporting Month copies it once from the preceding month, including paused items and their order, then becomes independent.
- The chosen current-month UI keeps Variant C's Monthly timeline and the History Filmstrip + Cover Flow structure from `prototypes/deledger-ui-prototype.html`; the Private Beta applies the Neutral Ledger system—white, black and gray with immutable opaque `#B5C69C` as its only chromatic accent and `#262626` foreground whenever that accent is a background—in both Light and Dark modes, defaulting to the device preference, as defined in `spec.md`. The logic evidence is in `prototypes/deledger-logic-prototype.html` and `prototypes/Deledger-logic-prototype.xlsx`.
- Every session must read `CONTEXT.md` and relevant ADRs, using `grilling` + `domain-modeling` for business decisions, `prototype` for flows that must be seen, and `research` for external technical facts.

## Decisions so far

- **Superseded secure online stack path** — The initial Vercel + Supabase recommendation is retained as research history but was replaced by the local private stack. ([ticket](issues/03-secure-online-stack-path.md))
- **Adopt the local private MVP stack** — Use local Next.js + PostgreSQL behind a Cloudflare private Access application and WARP, with exact-email OTP access, server-only data operations, transaction-local ownership context, `pg_cron` catch-up, and encrypted off-device backups. ([ticket](issues/07-local-private-stack.md))
- **Define the MVP expense-detail boundary** — Confirm at most one aggregate, confirmation-time snapshot per Monthly Recurring Expense; one-offs remain Unitemized Spending, and setup items are paused rather than deleted. ([ticket](issues/01-expense-detail-boundary.md))
- **Define manual month-close semantics** — Permit Manual Close only on the final day with complete, coherent Summary Inputs; Automatic Close remains unconditional, while all Closed Months stay correctable without reopening. ([ticket](issues/02-manual-close-semantics.md))
- **Validate first-use and Monthly History flows** — Start with a two-input Partial Month, keep Snapshot separate from Ending Balance, and use synchronized Filmstrip + Cover Flow history whose centered Cover contains the complete minimal monthly summary and only necessary correction actions. Later visual decisions preserve this structure while replacing grayscale production styling with accessible Neutral Ledger Light/Dark tokens, exact opaque `#B5C69C` as the only accent, dark-gray `#262626` on accent backgrounds, and a system-default theme preference. ([ticket](issues/04-first-use-and-history-prototype.md))
- **Define MVP identity and account lifecycle** — Admit only exact-email Cloudflare OTP invitees through WARP; keep administration outside Deledger, archive rather than permanently delete, restore the same User, and represent a post-archive return as a new Partial Month after an explicit Tracking Gap. ([ticket](issues/05-authentication-account-lifecycle.md))
- **Define the persistent month model** — Store only owner-scoped financial facts in seven PostgreSQL tables; derive monthly summaries and states on read, serialize mutations per User/month, and use idempotent active-versus-archived catch-up semantics. ([ticket](issues/06-persistent-month-model.md))

## Specification work remaining

- Completed in the executable technical specification; no remaining business decision constrains implementation planning.

## Output

- [Online Deledger MVP executable technical specification](spec.md)

## Out of scope

- Credit cards and card billing cycles — Phase 2.
- Named bank accounts, account aggregation, Internal Transfer entry, bank API connections, and imported transactions — outside the single aggregate Financial Boundary MVP.
- Multi-currency and exchange-rate conversion — MVP uses Thai baht only.
- Cash tracking as a separate balance source — the MVP accepts only the aggregate Financial Boundary balance.
- Native mobile applications and offline-first synchronization — the MVP is a responsive online web application.
- Notifications, forecasts, safe-to-spend meters, analytics, and trend charts — not required to prove the monthly accounting workflow.
- Source-repository scaffolding and production implementation — Wayfinder resolves decisions and hands off to `/to-spec`.
