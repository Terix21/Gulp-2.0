# Preferences Instructions

## Scope
Repository-level coding and review preferences.

## Conventions
- Prefer small, explicit functions with clear data flow.
- Maintain CommonJS module style in main and contracts code.
- Keep Electron security defaults explicit: contextIsolation true, nodeIntegration false.
- Favor deterministic tests and include regression tests for bug fixes.
- Apply the JavaScript SonarQube profile "Sonar way-EXP" as the project coding-standard baseline, with the repository copy documented in `instructions/SonarQubeProfile.md`.
- Treat Sonar Blocker and Critical issues as merge blockers for new or modified code.
- Keep custom Sonar rule thresholds aligned with the imported profile: S101 naming format `^\$?[A-Z][a-zA-Z0-9]*$`, S107 max params `7`, S1479 max switch cases `30`, S2004 max nested control flow `4`, S3776 cognitive complexity threshold `15`.

## Common Patterns
- For behavior changes, include one direct test that fails before and passes after.
- For persistence changes, validate both new database bootstrap and reopen paths.
- For renderer changes, keep Node APIs behind preload bridge only.

## Pitfalls
- Avoid silent fallbacks that hide migration failures.
- Avoid broad catch blocks that swallow useful diagnostics.
- Do not suppress Sonar findings to bypass quality gates unless there is a documented false-positive rationale in code review.

## Append-Only Updates
- 2026-04-01: Added explicit preference for regression-test-first fixes and deterministic open/reopen persistence checks.
- 2026-04-02: For history features, wire persistent storage at startup (`project-store` open + `history-log.setProjectStore`) and keep reopen-path tests for restart durability.
- 2026-04-02: Prefer desktop-workbench renderer layouts (fixed viewport, collapsible panes, activity bar, tabbed workspace, status bar) over document-like scrolling pages.
- 2026-04-02: Prefer virtualized dense data surfaces and buffered UI updates over large top-level arrays in React state.
- 2026-04-02: Default visual direction is dark-first with explicit severity semantics and reduced corner radius.
- 2026-04-02: Add short, purposeful comments only for non-obvious logic; prioritize why over what, and avoid comment noise on self-explanatory code.
- 2026-04-07: Adopted SonarQube JavaScript profile "Sonar way-EXP" as repository coding-standard baseline, documented in `instructions/SonarQubeProfile.md`, with merge-blocking severity policy for Blocker/Critical findings and explicit enforcement of profile thresholds (S101, S107, S1479, S2004, S3776).
- 2026-04-11: Theme system is CSS variable-driven: `applyThemeToDocument` injects `--sentinel-*` custom properties on `<html>`, which back Chakra semantic tokens (e.g. `fg.default`, `bg.panel`). All new color references in components must use Chakra semantic tokens or `var(--sentinel-*)` — never static hex codes. Do not add `color="black"` or literal hex to any renderer component without a documented override rationale.
- 2026-04-11: Form inputs (`Input`, `Textarea`, `Select`) must receive explicit Chakra token props (`color='fg.default'`, `bg='bg.surface'`) or a CSS-variable equivalent. Never rely on browser-default agent styling for form control colors — it breaks Dark Mode contrast.
- 2026-04-11: `color-scheme` on `<html>` must match theme mode (`light`/`dark`); `applyThemeToDocument` owns this via `root.style.colorScheme`. Never hardcode `color-scheme: dark` in global CSS for themes that also support light variants.
- 2026-04-11: Before merging any styling change, verify contrast ratios for the **Dark Circuit** theme (neon-on-dark) against WCAG AA (4.5:1 body text, 3:1 large/UI). It is the highest-risk theme for small-text failures.
- 2026-04-11: Search for `!important` on `color`, `background`, or `background-color` properties before adding new CSS rules. Existing `!important` flags shadow theme-variable overrides and must be removed or scoped before theme switching will work reliably.
- 2026-04-11: In renderer code, prefer `globalThis` access (`globalThis.window`, `globalThis.document`) over direct `window`/`document` globals to satisfy lint rules and keep runtime guards explicit.
- 2026-04-11: Prefer optional chaining and nullish-safe access (`obj?.prop`, `err?.message || fallback`) over chained `&&` guards for API checks and error-message fallbacks.
- 2026-04-11: String character-code access in new/modified code must use `String#codePointAt()` instead of `String#charCodeAt()` to avoid Unicode surrogate-pair errors.
- 2026-04-11: Treat all `react/prop-types` findings as required fixes in renderer components: define `propTypes` for every component and use explicit nested shapes for objects consumed in JSX/logic (for example `item.request`, `item.response`, table adapters and callback props).
- 2026-04-11: Do not leave unused state setters, locals, or helper functions (`setX` values from `useState`, dead callbacks, orphaned utility functions). Remove them in the same change where they become unused.
- 2026-04-11: Extract nested ternary expressions into independent statements/variables before render or before use in logic; avoid chained ternaries in JSX props and status/style selection.
- 2026-04-11: Keep helper functions that do not need closure state at module scope (outside React component bodies) to reduce cognitive complexity and nested-function depth.
- 2026-04-12: In renderer tests, use `globalThis` instead of `global`/`window` when setting globals and API shims, compare directly with `undefined` (avoid `typeof x === 'undefined'`), and avoid empty stub methods (return `undefined` explicitly in no-op mocks).
- 2026-04-12: Every renderer form control must have a programmatic accessible name. For native controls rendered with `as='select'`, always include `aria-label`, `aria-labelledby`, or `id` + `<label htmlFor>`; visual text alone is insufficient.
- 2026-04-12: Keep select styling centralized. Add/update shared select style definitions in `src/renderer/js/theme.js` (or a single shared wrapper) rather than duplicating long per-instance style prop sets across panels.
- 2026-04-12: In Node.js/CommonJS code, prefer `node:`-prefixed built-in module specifiers (`require('node:fs')`, `require('node:path')`, `require('node:child_process')`) over bare built-in specifiers.
- 2026-04-12: In repository-owned TypeScript configs, do not add `"moduleResolution": "node"` (legacy `node10` behavior). Prefer `"bundler"`, `"node16"`, or `"nodenext"`; if a third-party config cannot be migrated immediately, add `"ignoreDeprecations": "6.0"` as a temporary compatibility guard.
- 2026-04-12: Treat user-influenced regular expressions as security-sensitive. New or modified regex must avoid super-linear backtracking patterns (nested/overlapping unbounded quantifiers, ambiguous alternation under repetition, and unanchored fail-prone scans over large input). Prefer linear parsing/string operations for protocol/header parsing paths in `src/main/**`.
- 2026-04-12: In main-process, proxy, preload, contracts, and build/security-sensitive scripts, do not use `Math.random()` for values that leave process boundaries, mark probes, correlate scans, identify sessions, or otherwise benefit from unpredictability. Use Node CSPRNG APIs such as `randomUUID()` or `randomBytes()` instead.
