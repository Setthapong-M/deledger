# Decide preservation versus correction for existing inconsistencies

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 02

## Question

Which source-inspected discrepancies are intentional behavior to preserve, and which corrections are explicitly included in the migration? Discuss the concrete scenarios in [the behavior inventory](../behavior-inventory.md#discrepancies-and-concrete-parity-gaps) with the user; recommendations in research are not approval.

- Multi-month catch-up closes old rows before creating missing past months as open, so a subsequent invocation is needed to finish their Automatic Close.
- Closed Month detail PUT uses replacement semantics even when no detail exists, while UI action flags hide confirmation; cancellation remains possible.
- Downstream derivation depends on the immediately prior Ending Balance; `affectedMonthKeys` names the next calendar row even across a supplied-opening boundary.
- Same-kind local contact replacement inserts the new active contact before unlinking the old one, potentially violating immediate per-User uniqueness. Existing coverage does not exercise that replacement.
- Operator export omits phone identities; recovery verification lists seven original tables while the current schema has nine. Decide export scope separately from physical backup coverage.
- History limits months but appends all completed Tracking Gaps to every page.

For each scenario, record preserve/correct, expected observable result and acceptance evidence. Do not silently turn a stack migration into behavior redesign, or preserve an apparent defect as a requirement without surfacing it. This decision feeds the eventual spec; it does not implement fixes.

## Answer

Agent authorized to decide by user on 2026-09-06, preserving core business logic. Correct multi-month catch-up in one pass because all past Reporting Months must close automatically. Correct same-kind profile replacement by unlinking before inserting inside one transaction, retaining historical contact reservation and at least one active contact. Keep Closed Month detail PUT/cancel semantics, immediate-prior Ending Balance dependency, immediate-next affectedMonthKeys and current history gap pagination; do not redesign UI actions. Include phone identities in encrypted operator export, exclude session credentials/digests from user export, and verify all nine data tables on physical restore. Add targeted regressions for the two corrections plus existing contract parity. These are explicit bounded decisions, not a general license to change financial behavior.

## Comments

Resolved under explicit user delegation to the agent on 2026-09-06.
