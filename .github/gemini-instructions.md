# Gemini Instructions for Gulp (Electron + Gulp + React + Chakra UI)

## Bootstrap Requirements (Run First)
- Before handling a request, verify these files exist:
  - `.github/instructions/preferences.instructions.md`
  - `.github/instructions/edge-cases.instructions.md`
  - `.github/instructions/context-management.instructions.md`
  - `.github/instructions/_template.instructions.md`
  - `.vscode/settings.json`
- If any are missing:
  - Create missing `.github/instructions/*.md` files from the template structure.
  - Create `.vscode/settings.json` with project defaults when absent.
  - Complete creation in one pass, then continue the user task.

## Router and Context Rules
- On every request, detect framework/domain keywords and load matching instruction files.
- Apply all matching files, most specific first.
- If no framework-specific match exists, apply general coding defaults.
- For new frameworks/languages not in the registry, create `.github/instructions/<framework>.instructions.md` using `_template.instructions.md` and add it to the registry.
- Use full workspace context when diagnosing issues, including active files and recent terminal command context.

## Registry
- `electron` -> `.github/instructions/electron.instructions.md` (active)
- `gulp` -> `.github/instructions/gulp.instructions.md` (active)
- `react` -> `.github/instructions/react.instructions.md` (active)

## Append-Only Knowledge Updates
- Keep these instruction logs append-only.
- Route updates as follows:
  - Preferences -> `preferences.instructions.md`
  - Bugs/edge cases -> `edge-cases.instructions.md`
  - Framework patterns -> framework-specific instruction file
- Do not overwrite historical entries unless explicitly correcting invalid content.

## General Coding Defaults
- Write clear, maintainable code and avoid implicit state mutations.
- Follow language and ecosystem best practices for imports, error handling, and async patterns.
- Prefer strong typing and explicit interfaces when practical.
- Do not hardcode secrets; validate and sanitize inputs.
- Recommend unit/integration tests for behavior changes.

## Project Scope
- Desktop app built with Electron, React renderer components, Chakra UI, and a Gulp-based asset pipeline.
- Runtime entry point is `dist/main/index.js` (from `package.json -> main`).
- Source code lives in `src/`; `dist/` is generated output.

## Source of Truth
- Always edit files under `src/` and `gulpfile.js`.
- Never hand-edit `dist/` files except for temporary debugging.
- If a change is made in `src/`, mirror it by running the build/watch pipeline before validating runtime behavior.

## Build and Run Workflow
- Build once: `npx gulp build` (or `npm run dev` only for watch mode).
- Watch mode: `npm run dev` (runs `gulp watch`).
- Start app: `npm run start`.
- If UI changes are not visible, verify the corresponding file exists under `dist/renderer/`.

## Repository Conventions
- Module system: CommonJS (`require`, `module.exports`).
- Keep `src/main/` for Electron main/preload code and `src/renderer/` for browser UI code.
- Keep React renderer entry in `src/renderer/js/main.jsx` and components in `src/renderer/js/components/`.
- Wrap renderer root with `ChakraProvider` and prefer Chakra primitives in component UI.
- Prefer small, named functions for Gulp tasks and Electron lifecycle setup.
- Keep semicolon usage and single-quote string style consistent with existing files.

## Electron Safety Rules
- Preserve separation between main and renderer processes.
- Renderer code must not rely on Node.js APIs directly.
- Expose privileged APIs through `preload.js` only, using a narrow surface.
- Keep `BrowserWindow` web preferences secure and explicit when touching window creation:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` when feasible
- Use `path.join(__dirname, ...)` for file paths from main process code.

## Gulp Rules
- Keep paths centralized in the `paths` object.
- Use JSX-capable bundling for renderer code (React entry + component imports).
- When adding new asset types, add both build and watch entries.
- Keep task composition explicit:
  - `gulp.parallel(...)` for independent tasks
  - `gulp.series(...)` for ordered steps
- Avoid introducing minification/transforms that break renderer compatibility without verification.

## Change Checklist for Gemini
- Did you edit `src/` instead of `dist/`?
- Did you run/update the relevant Gulp task(s)?
- If preload or main changed, did you verify Electron startup still works?
- If renderer changed, did you keep Node.js access out of renderer scripts?
- If adding dependencies, are they in the correct section (`dependencies` vs `devDependencies`)?

## Known Risks to Watch
- `npm run start` depends on prebuilt `dist/` artifacts; missing build output will break startup.
- Security regressions can occur if BrowserWindow defaults are relied on instead of explicit settings.
- Changes under `src/main/` are copied as-is; avoid introducing environment-specific absolute paths.

## Session Summaries
- For longer threads (3+ back-and-forth exchanges on one task), include a short 5-bullet progress summary when useful.
- Offer to append durable patterns or lessons learned to the instruction files above.
