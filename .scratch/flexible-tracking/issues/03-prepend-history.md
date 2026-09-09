# 03: Add earlier months without changing existing balances

Status: complete — implementation and verification in [validation](../validation.md)
Blocked by: 02 — bounded range creation, supplied-boundary presentation and History correction
Parent: [Flexible tracking spec](../spec.md)

## What to build

ผู้ใช้ที่มีประวัติแล้วกด “เพิ่มเดือนย้อนหลัง” ใน History เลือกช่วงก่อนเดือนแรก และบันทึกยอดตั้งต้น/รายรับได้โดยไม่ล้างหรือเชื่อมทับยอดเดิม เดือนที่สร้างใหม่เติมต่อได้ผ่าน History corrections ของ ticket 02

Scope: spec D5, prepend tracking options/backfill interface in D8, reused D6/D9 and all preservation/concurrency scenarios.

## Acceptance criteria

- [x] History reads authoritative earliest-month boundary, eligibility/reason and range limits from tracking options, not the oldest entry in its currently loaded page.
- [x] No history links to onboarding; archived/resume-required Users cannot prepend. The selected date is before the earliest existing month and not future relative to backend date.
- [x] Preview the contiguous range through the month before current earliest history, at most 24 new months; explicitly show that existing supplied balances will not change.
- [x] Every created month must precede the effective current month. If earliest history is November but simulated date is September, reject an August prepend that would create/close September and October; preserve all data and prompt date adjustment.
- [x] First new month has supplied opening/explicit Income; subsequent new months use prior-ending/null amounts. Every new past month is Closed; setup starts empty, not copied backwards from current definitions.
- [x] Existing earliest month must use supplied opening. Reject a missing-prior inherited boundary rather than silently linking or repairing it.
- [x] Compare expected earliest key/revision under owner lock, reject concurrent stale/overlapping ranges, and roll back the entire range on failure.
- [x] Byte-equivalent existing financial source facts and revisions remain intact after insertion. In particular, September supplied=1000 stays 1000 after August Ending Balance becomes 9000.
- [x] Do not fill internal gaps, alter archive periods, move a tracked-from date inside an existing month or merge/relink segments.
- [x] Success refreshes chronological History and selects the new start month even beyond the current page. Network/revision errors retain user inputs and provide explicit reload/review.
- [x] API/PostgreSQL tests prove isolation, unchanged existing rows, 24/25-month limits, repeated/concurrent requests and failure rollback. Browser tests cover add → edit past totals → verify supplied later balance unchanged.
- [x] Run compiler/build and relevant regressions; update feature documentation and review standards/spec parity without source commits or DB resets.

## Comments

- 2026-09-09 — User approved prepend behavior preserving existing supplied balances; internal-gap backfill remains out of MVP scope.
