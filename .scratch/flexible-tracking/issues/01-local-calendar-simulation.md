# 01: Simulate the accounting date in local only

Status: complete — implementation and verification in [validation](../validation.md)
Blocked by: None (can start immediately)
Parent: [Flexible tracking spec](../spec.md)

## What to build

ผู้พัฒนา local เลือกวันทดสอบผ่านแถบวันที่ระบบ ทดลองวันสิ้นเดือน/ข้ามเดือน แล้วกลับวันที่จริงได้โดยไม่เปลี่ยนกติกาปิดเดือน ควบคุมให้ API, scheduler และ UI ใช้วันเดียวกัน พร้อมคำเตือนว่ามีผลกับทุกบัญชี local และไม่ย้อนข้อมูล

Scope: spec D1–D3, calendar/clock interfaces in D8, clock-related D9 and corresponding testing scenarios. Deliver the entire path from local UI through authenticated control and financial behavior; not just a clock helper.

## Acceptance criteria

- [x] Authenticated local sees real/simulated date, instance-wide warning, date picker and reset. Control is also available before first onboarding.
- [x] GET calendar and PATCH local clock use specified envelopes, strict validation, acknowledgment, real-time authentication and boot-scoped revision conflicts. Clock controls never trigger financial catch-up before changing the date.
- [x] QAS control calls return 404 without clock/financial mutation. Production remains startup-rejected. Date headers/query/cookies cannot enable simulation.
- [x] Fixed simulated date lives only for the API process; restart/reset returns real mode without deleting, recreating or reopening existing financial facts.
- [x] A local-only serialization gate covers clock changes, financial transactions/retries and scheduler ticks with one consistent lock order. Failure always releases the gate. Date never changes midway through an operation.
- [x] Sessions/JWTs, profile birthday validation, audit timestamps and operational health stay on real time. Existing automated clock seams remain usable.
- [x] Explicit stale local clock tokens on financial submissions fail before catch-up/writes; legacy callers without a token still use the backend date. Other tabs refresh date context on focus/polling and never apply obsolete responses.
- [x] Current/bootstrap returns the effective month's actual state after a backward date change, not the latest future Open Month. Outside-tracking state cannot offer duplicate onboarding; reset remains reachable.
- [x] Backward dates inside retained archival gaps/before restoration return outside-tracking and reject direct resume without changing the marker; normal resume remains available only on/after restoration and outside gaps.
- [x] Real-mode Bangkok midnight advances the local clock revision under the shared gate before token validation/catch-up; forms carrying the previous day's token fail without mutation.
- [x] UI calendar accepts server Today/date bounds for accounting while birthday keeps real-date semantics. Reuse current DateInput/Icon rather than replacing the UX.
- [x] Verify Sep 29 → Sep 30 → Oct 1: Manual Close final-day/coherence gates unchanged, Automatic Close works with missing information, owner catch-up is repeatable.
- [x] Verify two Users, concurrent tabs, scheduler/write overlap, transaction retry, failed change, API restart and backward reset through API/PostgreSQL tests plus a real browser journey.
- [x] Run relevant compiler/build gates, update local development instructions with warning/reset behavior, and review both standards and spec parity. Do not reset the user's local DB or commit unrelated changes.

## Handoff

Produces the authoritative calendar context and stable clock contract consumed by tickets 02–04. No DB migration, sandbox UI or persistent simulated date is part of this ticket.

## Comments

- 2026-09-09 — User approved the four-ticket breakdown and API+PostgreSQL/browser test boundary. Ticket is specified, not implemented.
