# Context Management Instructions

## Scope
Workspace context loading and review discipline for Electron + Gulp + React.

## Conventions
- Load the top-level copilot instructions first, then matching framework files.
- For runtime issues, inspect both source and build pipeline files.
- Prefer targeted, line-anchored findings over broad summaries.
- Validate with tests or build commands when findings involve behavior.

## Common Patterns
- For Electron startup bugs, read src/main/index.js, src/main/preload.js, and vite.config.js together.
- For persistence issues, read contracts + db implementation + tests before proposing changes.

## Pitfalls
- Do not review only dist output; source under src/ is authoritative.
- Do not treat passing type/lint checks as runtime validation.

## Append-Only Updates
- 2026-04-01: Added explicit workflow to connect runtime findings to concrete validation commands.
- 2026-04-02: After milestone completion, synchronize status docs (`instructions/JIRA_STORIES.md`, `README.md`, `instructions/TEST_COVERAGE.md`) in the same pass to prevent stale TODO/stub references.
- 2026-04-02: For UI-performance work, always review renderer component, preload bridge, and main-process emitter together before proposing state changes.
- 2026-04-02: Validate high-density surfaces with both architecture checks (virtualization/master-detail) and runtime checks (throttled event cadence, no unbounded top-level arrays).
- 2026-04-02: Keep plan/checklist/instruction updates aligned in the same change-set when architecture directives are introduced.
