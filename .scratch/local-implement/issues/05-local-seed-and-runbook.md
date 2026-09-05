# 05: Repeatable demo data and concurrent local/QAS workflow

**Status:** resolved

**Parent:** [Local development, QAS identity and User profile](../spec.md)

**What to build:** นักพัฒนาเริ่ม local พร้อมข้อมูลว่างหรือเลือก seed ตัวอย่างได้ และเข้าใจวิธีรันคู่กับ QAS โดยไม่เปลี่ยนข้อมูลหรือการเข้าใช้งานของ QAS

**Blocked by:** 04 — Personal information and linking login contacts.

- [x] Document exact install, local configuration, database setup/migration, start, login, profile and optional seed commands using this repository's existing tooling.
- [x] Optional deterministic demo Users demonstrate email, phone and linked identifiers, optional birthday and financial views. Re-running seed does not duplicate or overwrite User-entered data.
- [x] No sample financial data is created automatically at login/startup. Fresh User continues to the original onboarding path.
- [x] Seed and local setup reject QAS/prod targets and never truncate/reset a database; dedicated local/test/QAS resource names and credentials are explicit.
- [x] Verify local and QAS configurations do not collide in ports, explicitly named Docker volumes/networks, database targets or cookies, without operating the live QAS stack.
- [x] Document QAS invitation by Cloudflare email, immediate access after JWT validation, read-only contacts and unsupported prod startup.
- [x] Record the development exception to the existing private-beta deployment decision without claiming public prod is deployed; preserve the existing domain glossary and financial ADRs.
- [x] Run lint/typecheck, production build and relevant unit/integration/browser/operations checks for the feature. Record evidence and failures honestly; no external Cloudflare/SMS calls or live deployment.

## Implementation notes

Keep source changes scoped to this feature. Pre-existing changes to deployment scripts, Docker setup and tests must be inspected and preserved, not staged or overwritten as if authored by this ticket.
