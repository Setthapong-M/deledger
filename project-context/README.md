# Deledger project context

This is the shared entry point and home of engineering standards for developers and AI agents. Use the [router](smart_router.yml) to select relevant context. YAML paths are repository-root-relative; Markdown links are relative to their document.

## Single source of truth

Each fact has one owner. This folder centralizes discovery without making competing copies of existing authoritative documents.

| Information | Authoritative location | Maintenance |
| --- | --- | --- |
| Domain vocabulary | [CONTEXT.md](../CONTEXT.md) | Define domain terms here, not in session notes |
| Architectural decisions | [docs/adr/](../docs/adr/) | Record accepted changes and preserve superseded history |
| Current topology and impact | [architecture](architecture/overview.md) | Update when ownership, entry points or consumers change |
| Engineering conventions | [standards](standards/common/README.md) | Update the owning standard with implementation |
| Versions, scripts, schema | Executable files indexed by [project.yml](config/project.yml) | Resolve exact values from manifests, lockfile, Prisma and Compose |
| Operations | [docs/operations](../docs/operations/) | Keep executable procedures in the runbooks |
| Work tracking | [tracker conventions](../docs/agents/issue-tracker.md) | Use `.scratch/<effort>/` for maps, specs and tickets |
| Evidence / handoff | [memory](memory/README.md), [session](session/README.md) | Link historical facts; do not override standards or imply current runtime state |

User instructions define authorized scope. Compare accepted ADRs, implementation and tests when determining intended behavior. ADR 0008 supersedes the single-Next topology in ADR 0005/0007 while retaining the private/local boundaries. If code and a document disagree, record both sources and resolve the drift explicitly rather than treating old specs or current code as infallible.

## Reading procedure

1. Read `smart_router.yml` and its baseline once.
2. Match task intent and touched paths. Select all matching routes, union their `read` lists and deduplicate.
3. Read the listed files before editing their area. A directory pointer means select relevant files, not recursively load everything.
4. Follow the impact map to affected consumers and add their routes if scope expands.
5. Verify the change with relevant QA gates and update its owning document. Use the fallback if nothing matches.

The router is a human/agent-readable index, not executable classification or an installed IDE integration. `AGENTS.md` is the shared bootstrap; `CLAUDE.md`, `GEMINI.md` and the Cursor rule point back to it. If a client does not discover those files, include `AGENTS.md` and the router explicitly in the prompt.

## Browse

- [System flow](architecture/overview.md), [impact map](architecture/impact-map.md)
- [Common](standards/common/README.md), [backend](standards/backend/README.md), [frontend](standards/frontend/README.md), [database](standards/backend/database.md)
- [Development](guides_flows/development.md), [new use case](guides_flows/new-use-case.md), [migrations](guides_flows/migrations.md)
- [Known issues](troubleshooting/known-issues.md), [testing](qa_testing/README.md), [review](review/REVIEW_GUIDELINES.md), [drift register](review/drift.md)

Documentation changes must keep router targets, Markdown links and source references valid. Keep secrets, tokens, user data and raw runtime logs outside this folder.
