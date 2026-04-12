# Gulp 2.0 (Electron + React + Chakra UI + Vite)

Sentinel is a desktop web-security workbench built with Electron in the main process and React + Chakra UI in the renderer. The build pipeline is Vite-based.

## Current Status
- Milestones M1-M9 are implemented in this branch.
- Main-process IPC extraction and embedded-browser certificate verification hardening are complete.
- Native module workflow is hardened with conditional postinstall rebuild plus explicit `rebuild:native` for packaging.
- The Gulp build pipeline has been removed and replaced by Vite.

## Tech Stack
- Electron `^41.1.0`
- React `^19.1.0` + React DOM
- Chakra UI `^3.34.0`
- Vite `^7.1.10` (+ Electron/React plugins)
- Sass `^1.98.0`
- Vitest + Testing Library
- JavaScript (CommonJS + JSX)

## Source of Truth
- Edit source under `src/`.
- Do not hand-edit `dist/` except temporary debugging.
- Rebuild after source changes before runtime validation.

## Build and Run

```bash
npm install
npm run build
npm run start
```

For iterative development:

```bash
npm run dev
```

## Native Modules
- Local installs may run conditional postinstall rebuild logic via `scripts/native/maybe-rebuild.js`.
- If native ABI issues appear, run:

```bash
npm run rebuild:native
```

## Documentation
Project documentation now lives under `instructions/`:
- `instructions/APP_COMPLETION_AND_TEST_CHECKLIST.md`
- `instructions/SENTINEL_IMPLEMENTATION_PLAN.md`
- `instructions/ARCHITECTURE_MIGRATION_PLAN.md`
- `instructions/VITE_MIGRATION_PLAN.md`
- `instructions/TEST_COVERAGE.md`
- `instructions/END_USER_GUIDE.md`
- `instructions/INSTALLER_CREATION_GUIDE.md`
- `instructions/SonarQubeProfile.md`
- `instructions/JIRA_STORIES.md`

## Core Scripts
- `npm run clean` -> remove generated `dist/` output
- `npm run build` -> build metadata + Vite bundles into `dist/`
- `npm run dev` -> Vite dev workflow
- `npm run start` -> launch Electron runtime
- `npm run rebuild:native` -> rebuild native modules for current Electron ABI
- `npm test` -> Vitest
- `npm run test:coverage` -> coverage run
- `npm run test:build` -> clean + build + post-build smoke validation

## Pre-PR Lint Checklist
- Run `npm run build` and `npm test` before opening the PR.
- In renderer code, prefer `globalThis.window` / `globalThis.document` over bare globals.
- Use optional chaining (`?.`) instead of chained `&&` guard access.
- Define `propTypes` for every component, including nested object fields and callback props.
- Extract nested ternary expressions into independent statements or lookup variables.
- Remove unused state setters, locals, and dead helper functions.
- Prefer `String#codePointAt()` over `String#charCodeAt()`.

## Security Notes
- Keep renderer free of direct Node.js imports.
- Expose privileged operations only through `src/main/preload.js`.
- Keep BrowserWindow security options explicit:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
