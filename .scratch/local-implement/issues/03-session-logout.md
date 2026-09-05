# 03: Local logout, expiry and switching Users

**Status:** resolved

**Parent:** [Local development, QAS identity and User profile](../spec.md)

**What to build:** Local User กลับมาใช้งานภายใน 7 วันได้โดยไม่กรอกซ้ำ และ logout เพื่อเปลี่ยนเป็น User อื่นได้โดยไม่เห็นข้อมูลค้างของคนก่อน

**Blocked by:** 01 — Local email login with isolated environment and preserved QAS access.

- [x] Refresh/browser reopening retains an unexpired session; seven days is absolute, with no automatic sliding extension.
- [x] An origin-validated logout action revokes the current server-side session and clears its cookie; replay of the old token is denied.
- [x] Missing/expired/revoked sessions on direct protected navigation return to local login; expiry during use clears stale personal/financial views.
- [x] Login as User B after logout from A displays only B's profile/financial state. User A's data remains intact when A logs in again.
- [x] Archiving a User denies an existing session without automatically recreating/restoring the User.
- [x] QAS retains existing Cloudflare behavior and never presents local logout as ending the Cloudflare session.
- [x] Browser/HTTP tests verify logout replay, absolute expiry with controlled time, direct navigation and switching two email Users. Do not use wall-clock waits of seven days.
