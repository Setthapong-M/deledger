# 02: Detect email or Thai phone in the same login field

**Status:** resolved

**Parent:** [Local development, QAS identity and User profile](../spec.md)

**What to build:** User กรอก email หรือเบอร์มือถือไทยในช่อง Phone number or email แล้วเข้าใช้งาน local โดยระบบเลือกชนิด identifier ให้อัตโนมัติ

**Blocked by:** 01 — Local email login with isolated environment and preserved QAS access.

- [x] Accept email and Thai mobile 06/08/09 domestic forms or equivalent +66 forms; spaces/hyphens in phones normalize as specified; reject other unsupported values.
- [x] Domestic and international representations resolve the same User. Phone-only Users have no fabricated email.
- [x] First phone login creates one empty User atomically; repeats and concurrent first logins reuse that User.
- [x] A phone not linked to an existing email User creates a distinct User; never guess identity or merge records.
- [x] Invalid phone/email input presents useful inline feedback without creating Users or issuing sessions.
- [x] Browser and database-backed tests cover phone onboarding, repeat login, normalization, concurrent creation and isolation from an unrelated email User.
- [x] QAS remains email/JWT based and exposes no phone login or local registration endpoint.
