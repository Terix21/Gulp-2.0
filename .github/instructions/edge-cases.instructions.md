# Edge Cases Instructions

## Scope
Known operational and implementation edge cases for this repository.

## Conventions
- Treat database open and migration as failure-prone boundaries.
- Keep renderer/browser paths independent of shell working directory.
- Assume test toolchains can fail from dependency resolution and verify explicitly.

## Common Patterns
- Close sqlite connections on all open/migration failure paths.
- Use path.join(__dirname, ...) for Electron file loads.
- Keep migration chains contiguous: fromVersion N must have a path to N+1.

## Pitfalls
- Assigning shared singleton state before successful initialization causes leak/lock issues.
- CWD-relative renderer paths fail in packaged or non-standard launch contexts.
- A single broken jsdom install can invalidate all Vitest suites using jsdom environment.

## Append-Only Updates
- 2026-04-01: Added migration-chain, DB-open cleanup, and jsdom resolution failure patterns observed in this repo.
- 2026-04-02: History queries may fallback to in-memory mode when project-store bootstrap fails; verify persistent mode with reopen tests and avoid assuming durability from runtime-only checks.
- 2026-04-02: Unthrottled per-event React updates from proxy/scanner streams can freeze renderer under burst traffic; use buffered flush windows (100-200ms).
- 2026-04-02: Rendering full proxy arrays in top-level state causes memory growth and list thrash; use virtualization and demand-loaded detail panels.
- 2026-04-02: Row selection should not trigger table data regeneration; keep master list model stable and isolate inspector state.
- 2026-04-08: Vite production builds do not transform CJS require() in renderer source files — all renderer JS/JSX must use native ESM (import/export). Use scripts/cjs-to-esm.js for bulk conversion. @rollup/plugin-commonjs and @originjs/vite-plugin-commonjs both fail or produce noise in this stack; do not add them.
- 2026-04-08: GPU disk-cache access-denied errors at Electron startup on Windows are non-fatal and do not affect renderer rendering; they are Chromium cache-path permission issues only.
