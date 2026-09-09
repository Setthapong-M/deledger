# 02: Start tracking from a past date

Status: complete — implementation and verification in [validation](../validation.md)
Blocked by: 01 — authoritative calendar context and simulation-aware transaction boundary
Parent: [Flexible tracking spec](../spec.md)

## What to build

ผู้ใช้ใหม่เลือกวันเริ่มย้อนหลังและกรอกยอดเงิน ณ วันนั้นกับรายรับของช่วงนั้นได้ ระบบสร้างประวัติถึงเดือนปัจจุบันโดยไม่สมมติตัวเลข และให้เติม/แก้ Income กับ Ending Balance ใน History เพื่อทำให้เดือนเก่าครบได้จริง

Scope: spec D1, D4, D6, onboarding/Month View interfaces in D8 and relevant D9. History correction belongs here so this slice is usable end to end; ticket 03 reuses it for existing Users.

## Acceptance criteria

- [x] Onboarding has localized start date, balance-at-start and Income-period labels, defaults to backend business date and preserves values across language changes/errors.
- [x] Date is valid and nonfuture; range is at most 24 months including current. Reject invalid/oversized ranges before mutation and show the range that will be created.
- [x] Existing callers omitting startDate keep today's behavior. A User with any existing Reporting Month or an operator resume marker cannot use onboarding to overwrite/restart.
- [x] Atomic owner-locked creation stores the first month as supplied, tracked from the selected day, with explicit opening/Income. Following months inherit only prior Ending Balance with null Income/Ending Balance.
- [x] Past months are automatically Closed; current month Open; missing data remains unknown. No snapshots, paid details or invented income are generated.
- [x] Onboarding response remains an effective current Month View. Historical onboarding navigates to the selected start month in History, including when not on the first paginated page.
- [x] History exposes revision-checked Income and Ending Balance corrections for authorized months, without reopening or permitting past snapshots/setup writes. Errors keep the selected month and input available.
- [x] Month View communicates openingSource. Supplied Starting Balance is labelled, remains read-only in this scope, and stops affected-month warnings/refresh propagation.
- [x] Partial Month copy on onboarding, current summary/timeline and edit dialogs consistently identifies the tracked Income interval rather than an entire month.
- [x] Test multi-month/year-boundary onboarding, leap dates, 24/25-month limits, missing/zero distinction, duplicate submissions, ownership, partial rollback and old request compatibility through API/PostgreSQL.
- [x] Test the complete select-start → create → History correction → current-balance flow in Thai/English and mobile/keyboard browser tests.
- [x] Run compiler/build and focused regression gates; preserve original closure, archive/resume and confirmation-snapshot contracts.

## Handoff

Produces bounded supplied/prior-ending range creation, shared period-labelled input UX, supplied-boundary presentation and History correction actions. Ticket 03 reuses these; ticket 04 uses supplied-boundary presentation and tracked-period input semantics.

## Comments

- 2026-09-09 — User approved four vertical slices. Historical summary correction is included here because a created past month must be completable without a later ticket.
