# Session handoff

Active progress belongs in `.scratch/<effort>/` under [tracker conventions](../../docs/agents/issue-tracker.md). This directory defines handoff format, not a second issue tracker. A committed session note is optional and must be a useful sanitized snapshot.

Record when handing off:

1. Objective, accepted decisions and exact remaining scope.
2. Observed branch/commit/PR and dirty files to preserve.
3. Completed changes/evidence; separate attempted and passed checks.
4. Remaining work, blockers and next concrete action.
5. Authorized operational targets and whether an action occurred; never infer renewed reset permission from an old handoff.
6. Required context routes/documents for resumption.

Keep secrets/raw logs outside Git. Close tracker items on completion and promote reusable findings to [memory](../memory/README.md) or the owning standard. Transient branches, live service status and test counts are not project policy.
