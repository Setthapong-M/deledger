# 01: Local email login with isolated environment and preserved QAS access

**Status:** resolved

**Parent:** [Local development, QAS identity and User profile](../spec.md)

**What to build:** นักพัฒนาเปิดแอป local โดยไม่ผ่าน Cloudflare กรอก identifier แล้วเข้าสู่ User เดิมหรือเริ่ม onboarding ของ User ใหม่ ผ่านฐานข้อมูล local ที่แยกจาก QAS โดย QAS ยังตรวจ JWT และเข้าเว็บได้ทันทีตามเดิม

**Blocked by:** None (can start immediately).

- [x] Provide explicit local/qas/prod configuration; absent env preserves QAS; invalid env and unsupported prod fail closed. Local never needs Cloudflare credentials.
- [x] Dedicated loopback local web/database configuration uses separate credentials, ports, persistent volume and networks; test database remains separate.
- [x] Login UI with one identifier field resolves a normalized valid identifier or atomically creates an empty User; email and Thai phone formats are handled by the shared identifier normalizer.
- [x] New Users enter existing onboarding; returning Users retain the same stable ID, financial records and lifecycle routing.
- [x] Issue a persistent opaque seven-day absolute local session in an HttpOnly SameSite host-only cookie. Protected requests validate its digest/expiry and bind normal restricted RLS transactions.
- [x] Invalid input, missing/tampered/expired sessions and Archived Users fail without orphan/duplicate Users or finance access; concurrent login of one email creates only one User.
- [x] QAS validates Cloudflare JWT for every protected request and preserves invited/archived checks; no app login/OTP appears, and a local cookie cannot bypass JWT validation.
- [x] Origin validation protects local login. Local identity-resolution/provisioning capability is unavailable through QAS endpoints; no broad database privileges are granted to bypass RLS.
- [x] Demonstrate email login through UI and bootstrap/financial operations; exercise QAS regression and two-User RLS isolation using local test fixtures.

## Implementation notes

Follow the parent spec. Use new additive migrations and retain existing QAS email mapping/operator compatibility. A phone-only identity is delivered by ticket 02; full logout behavior by ticket 03. Base session security and expiry belong here, not a later hardening phase.
