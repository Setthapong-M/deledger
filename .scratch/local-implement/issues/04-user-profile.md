# 04: Personal information and linking login contacts

**Status:** resolved

**Parent:** [Local development, QAS identity and User profile](../spec.md)

**What to build:** User เปิดหน้าข้อมูลส่วนตัวเพื่อดู email เบอร์โทร และวันเกิด โดย local ผูกช่องทาง login ได้ทั้งสองทิศทาง ส่วน QAS แก้เฉพาะวันเกิด

**Blocked by:** 02 — Detect email or Thai phone in the same login field; 03 — Local logout, expiry and switching Users.

- [x] Navigation provides a self-profile destination for an authenticated User, including before financial onboarding; missing values display ยังไม่ได้ระบุ.
- [x] Optional date of birth can be saved/cleared in both envs; reject future/impossible dates and preserve the calendar date without timezone shifts.
- [x] Local User can add/replace/remove current email and phone but cannot remove both. Validate the canonical identifiers from ticket 02.
- [x] Link a phone while signed in by email, logout, then login by either Thai phone representation: same User and financial records. Cover the reverse phone-to-email journey.
- [x] Reject contacts owned/reserved by another User and concurrent linking collisions atomically without partial save, orphan identity or User merge.
- [x] Editing a contact retains current stable-User sessions; removed contacts no longer authenticate the former owner. Local contacts are not represented as OTP-verified.
- [x] QAS displays existing email and optional phone read-only; reject contact changes at the server regardless of UI restrictions. Date of birth remains editable.
- [x] Protect profile reads/writes with the same User binding and RLS; owner IDs supplied by clients cannot access another User. Mutations use origin validation.
- [x] Add accessible labels, save/error states and duplicate-field feedback. Tests cover cross-User access, all contact constraints, optional dates and QAS read-only behavior using real database permissions.
