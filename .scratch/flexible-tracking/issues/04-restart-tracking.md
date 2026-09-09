# 04: Start a fresh current-month segment after missing history

Status: complete — implementation and verification in [validation](../validation.md)
Blocked by: 02 — server date integration, supplied-boundary presentation and tracked-period input flow
Parent: [Flexible tracking spec](../spec.md)

## What to build

ผู้ใช้ที่เดือนก่อนขาดยอดสิ้นเดือนเริ่มเดือนปัจจุบันจากยอดตั้งต้นใหม่ได้ โดยไม่ต้องเติมอดีต ไม่ทับข้อมูลเดือนปัจจุบันที่เคยกรอก และยังเก็บรายการประจำที่ระบบคัดลอกมาให้

Scope: spec D7, restart tracking options/interface in D8, shared D1/D6/D9 and restart security/continuity tests. This ticket does not depend on ticket 03's prepend endpoint.

## Acceptance criteria

- [x] Tracking options exposes restart eligibility/reason and current month/revision after catch-up; the UI offers Start fresh only for an unknown inherited opening and shows History correction as an alternative.
- [x] Server requires active/non-resume User; effective current Open Month; prior-ending opening with missing prior Ending Balance; null supplied opening/Income/Ending Balance; no snapshot/detail; revision exactly zero.
- [x] Automatically copied setup including paused items does not block restart. Any user setup edit, amount including zero, snapshot, confirmation/cancel or prior supplied start blocks it, including edits later undone.
- [x] Form allows only a date in the effective current month through today, with explicit balance-at-start and Income since that date. Confirm that earlier records remain but do not determine the new starting balance.
- [x] One owner-locked revision-checked mutation changes only current month to supplied opening, updates tracked-from/Income and increments revision once. Copied setup and all historical/archive facts stay unchanged.
- [x] No early-close override, reopening, archive marker manipulation, second restart within the same month or edited-month replacement is introduced.
- [x] Later prior-month corrections stop at the new supplied boundary; future months inherit the restarted month's Ending Balance normally.
- [x] Conflict/network errors preserve inputs and require review; clock changes cannot retarget the operation to another month. Foreign owner/expired session/archive or forged eligibility fail without writes.
- [x] PostgreSQL/API tests cover eligible copied setup, every exclusion, repeated/colliding writes, rollback and old-month independence. Browser tests cover incomplete September → fresh October → correct September → unchanged October.
- [x] Run compiler/build and relevant regressions; document the difference between Tracking Restart and archive/resume, then review standards/spec parity.

## Comments

- 2026-09-09 — User accepted that a populated current month cannot be overwritten in the initial MVP. Copied system setup is retained, not treated as a manual financial input.
