# Drift register

Specific mismatches, not blanket permission to ignore standards. Verify against the current commit; link evidence when resolved.

| ID | Status | Evidence / impact | Handling |
| --- | --- | --- | --- |
| D-001 | Open | `web/eslint.config.mjs` excludes TS/TSX | Use compiler/tests/review; expanding lint needs separate verification |
| D-002 | Superseded history | ADR 0005/0007 single-Next topology replaced by ADR 0008 | Use current ownership while preserving earlier private/local constraints |
| D-003 | Historical spec drift | `.scratch/deledger-online-mvp/` predates local identity/profile and migrated persistence | Compare current code/tests, migration effort and ADRs; resolve disagreements explicitly |

New entries name conflicting sources, affected workflow, status and resolution. Temporary execution blockers belong in the effort tracker, not permanent standards.
