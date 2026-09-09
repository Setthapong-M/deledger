# Separate clock simulation from tracking restarts

The accepted product direction retains ADR 0003's final-day, complete-and-coherent Manual Close gate; no early-close override is added. Only the local environment may expose an explicit simulated business date shared by presentation and backend; QAS and production must not expose or accept this capability, including through direct backend requests. Historical starts should support both new Users and existing Users without deleting existing records.

A User who does not want to complete earlier months may start a new tracking segment on a selected date with a supplied Starting Balance and Income since that date. Earlier records remain preserved, and later corrections to those records do not change the new segment's supplied Starting Balance; this is distinct from both Manual Close and archival's Tracking Gap.

Adding historical months preserves any existing supplied Starting Balance in later months rather than automatically linking it to a newly inserted month's Ending Balance. In the initial implementation, a tracking restart may use an automatically created month with no user-entered financial facts, but cannot overwrite an already-populated month; the User must correct that month instead.

For the MVP, local simulation uses the existing local database, not a separate sandbox or database-copy workflow. One process-local accounting-date override is shared by local Users and scheduler operations; resets or API restarts restore the real date but never undo financial writes, and session/security time remains real. The UI must disclose the instance-wide scope and no-rollback consequence before a date change.

These are accepted design decisions, not a claim that the features are implemented. The executable behavior, limits and four implementation tickets are recorded in the [flexible-tracking specification](../../.scratch/flexible-tracking/spec.md).
