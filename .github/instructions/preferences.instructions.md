# Preferences Instructions

## Scope
Repository-level coding and review preferences.

## Conventions
- Prefer small, explicit functions with clear data flow.
- Maintain CommonJS module style in main and contracts code.
- Keep Electron security defaults explicit: contextIsolation true, nodeIntegration false.
- Favor deterministic tests and include regression tests for bug fixes.

## Common Patterns
- For behavior changes, include one direct test that fails before and passes after.
- For persistence changes, validate both new database bootstrap and reopen paths.
- For renderer changes, keep Node APIs behind preload bridge only.

## Pitfalls
- Avoid silent fallbacks that hide migration failures.
- Avoid broad catch blocks that swallow useful diagnostics.

## Append-Only Updates
- 2026-04-01: Added explicit preference for regression-test-first fixes and deterministic open/reopen persistence checks.
- 2026-04-02: For history features, wire persistent storage at startup (`project-store` open + `history-log.setProjectStore`) and keep reopen-path tests for restart durability.
- 2026-04-02: Prefer desktop-workbench renderer layouts (fixed viewport, collapsible panes, activity bar, tabbed workspace, status bar) over document-like scrolling pages.
- 2026-04-02: Prefer virtualized dense data surfaces and buffered UI updates over large top-level arrays in React state.
- 2026-04-02: Default visual direction is dark-first with explicit severity semantics and reduced corner radius.
- 2026-04-02: Add short, purposeful comments only for non-obvious logic; prioritize why over what, and avoid comment noise on self-explanatory code.
