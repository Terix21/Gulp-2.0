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
- 2026-04-11: Dark-mode text invisibility in `Input`/`Textarea` components: Chakra v3 form controls do not inherit `fg.default`/`bg.surface` from the theme automatically — they fall back to browser agent styles if no explicit color props are set. Always supply `color='fg.default'` and `bg='bg.surface'` on every form input; omitting them is the primary cause of invisible text in Dark Mode.
- 2026-04-11: `!important` on CSS `color` or `background-color` properties blocks `--sentinel-*` variable overrides injected by `applyThemeToDocument`. Before theme tokens appear not to work in a component, search for `!important` in `style.scss` and any component-level CSS modules. Remove or re-scope them.
- 2026-04-11: Theme mode drift: `document.documentElement.dataset.theme` (set by `applyThemeToDocument`) and Chakra's internal `colorMode` can diverge if theme switching code updates one but not the other. The result is Chakra `useColorModeValue` returning the wrong branch while CSS variables are correct, or vice versa. Treat them as a single unit — update both atomically or don't use `useColorModeValue` at all (prefer CSS variables via semantic tokens instead).
- 2026-04-11: `color-scheme: dark` hardcoded in global CSS overrides the light-theme scrollbar, form-control, and OS-native widget rendering. The `color-scheme` property must be set programmatically via `root.style.colorScheme` in `applyThemeToDocument`, not via a static CSS rule. Remove any static `color-scheme` declarations from `style.scss`.
- 2026-04-11: Scrollbar invisible on dark themes with non-default OS settings — always provide `::-webkit-scrollbar` rules scoped to `[data-theme='dark']` and `[data-theme='light']` using `--sentinel-*` variables. Without this, Chromium falls back to the OS scrollbar which may be light-on-light on Windows with light OS themes.
- 2026-04-11: Activity-bar / nav-rail labels losing contrast is caused by static color values (e.g. `color='gray.500'`) that don't shift between light/dark themes. Replace with `color='fg.muted'` (inactive) / `color='fg.default'` (active). Hardcoded gray scale values are NOT theme-aware.
