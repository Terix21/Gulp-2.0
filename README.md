# Gulp (Electron + Gulp + React + Chakra UI)

Desktop security-workbench foundation built with Electron (main process), React + Chakra UI (renderer), and Gulp (build/watch pipeline).

## Current Status
- Electron + renderer scaffold is running from built output (`dist/main/index.js`).
- Chakra UI integration is in place with theme config in `src/renderer/js/theme.js`.
- Vitest test setup exists (`test`, `test:ui`, `test:coverage` scripts).
- Sentinel M1-M9 capabilities are implemented: CA lifecycle, intercepting proxy, rules, persistent history, Repeater response viewers, Intruder payload attacks, target/scope management, scanner/OOB/sequencer workflows, decoder/embedded-browser workflows, extension automation, and the high-density workbench UI shell.
- Proxy runtime configuration now supports project-persisted custom outbound headers, configurable tool-identifier header injection, and static source-IP rotation.
- Workbench shell includes a two-state module sidebar (collapsed icon-only and expanded icon+title modes), animated context rail transitions, keyboard-accessible quick actions, and preserved context-rail scroll/focus behavior.
- Latest validation snapshot includes broad backend/renderer coverage with two known unrelated embedded-browser test failures tracked separately.
- Sentinel roadmap and checklist are tracked in:
   - `APP_COMPLETION_AND_TEST_CHECKLIST.md`
   - `SENTINEL_IMPLEMENTATION_PLAN.md`

## Tech Stack
- Electron `^41.1.0`
- React `^19.1.0` + React DOM
- Chakra UI `^3.34.0`
- Emotion (`@emotion/react`, `@emotion/styled`)
- Framer Motion
- Gulp `^5.0.1`
- esbuild (`gulp-esbuild`) for renderer bundling
- Sass (`gulp-sass` + `sass`)
- Vitest + Testing Library
- JavaScript (CommonJS + JSX)

## Current Project Structure

```text
.
├─ gulpfile.js
├─ package.json
├─ README.md
├─ APP_COMPLETION_AND_TEST_CHECKLIST.md
├─ SENTINEL_IMPLEMENTATION_PLAN.md
├─ TEST_COVERAGE.md
├─ vitest.config.js
├─ vitest.setup.js
├─ src/
│  ├─ main/
│  │  ├─ index.js
│  │  ├─ preload.js
│  │  ├─ certs/
│  │  │  └─ ca-manager.js                  (CA lifecycle service)
│  │  ├─ db/
│  │  │  └─ project-store.js               (SQLite project persistence service)
│  │  ├─ proxy/
│  │  │  ├─ intercept-engine.js            (intercept queue + pause/edit/forward/drop)
│  │  │  ├─ history-log.js                 (persistent queryable traffic history)
│  │  │  ├─ protocol-support.js            (HTTP/1.1 proxy runtime)
│  │  │  ├─ rules-engine.js                (match/replace rule execution)
│  │  │  ├─ repeater-service.js            (editable resend workflow + per-send history)
│  │  │  ├─ intruder-engine.js             (payload attack runtime + progress/results)
│  │  │  ├─ target-mapper.js               (scope rules, imports, and sitemap generation)
│  │  │  ├─ scanner-engine.js              (passive+active vulnerability checks with persisted findings)
│  │  │  ├─ oob-service.js                 (payload listener and callback correlation service)
│  │  │  ├─ sequencer-service.js           (token capture, entropy analysis, and CSV export)
│  │  │  ├─ decoder-service.js             (chained transform engine with reversible execution)
│  │  │  ├─ extension-host.js              (sandboxed extension + script automation runtime)
│  │  │  └─ embedded-browser-service.js    (proxy-routed in-app browser session service)
│  │  └─ __tests__/
│  └─ renderer/
│     ├─ index.html
│     ├─ scss/
│     │  └─ style.scss
│     └─ js/
│        ├─ main.jsx
│        ├─ theme.js
│        ├─ __tests__/
│        └─ components/
│           ├─ App.jsx
│           ├─ __tests__/
│           └─ sentinel/
│              ├─ DashboardShell.jsx       (dashboard shell + CA guidance summary)
│              ├─ ProxyPanel.jsx           (intercept queue control, request editing, and runtime forwarding settings)
│              ├─ HistoryPanel.jsx         (paginated filterable history + tool handoff)
│              ├─ RepeaterPanel.jsx        (response viewers + compare workflow)
│              ├─ IntruderPanel.jsx        (marker-based attack editor + live results)
│              ├─ TargetMapPanel.jsx       (scope CRUD, Burp/CSV import, and in/out-scope sitemap)
│              ├─ ScannerPanel.jsx         (active/passive findings orchestration panel)
│              ├─ OobPanel.jsx             (payload generation and callback correlation panel)
│              ├─ SequencerPanel.jsx       (capture/analyze/export entropy workflow panel)
│              ├─ DecoderPanel.jsx         (chain editor with intermediate output and reverse mode)
│              ├─ ExtensionsPanel.jsx      (extension install/toggle/remove + audit log panel)
│              ├─ EmbeddedBrowserPanel.jsx (session/address bar panel with embedded response preview)
│              └─ __tests__/
└─ dist/ (generated)
```

## Source of Truth
- Edit only `src/` and `gulpfile.js`.
- Do not hand-edit `dist/` except temporary debugging.
- Rebuild after source changes before runtime validation.

## Install

```bash
npm install
```

## Build and Run

```bash
npx gulp clean
npx gulp build
npm run start
```

For watch workflow:

```bash
npm run dev
```

## Scripts
- `npm run clean` -> Remove generated `dist/` output
- `npm run build` -> Build renderer and main artifacts into `dist/`
- `npm run dev` -> Gulp watch pipeline
- `npm run start` -> Electron runtime
- `npm test` -> Vitest
- `npm run test:build` -> Clean + build + run post-build `dist/` validation smoke tests
- `npm run test:ui` -> Vitest UI
- `npm run test:coverage` -> Coverage run
- `npm run build:metadata` -> Generate `src/contracts/build-info.json` with version, git, and build context

## Testing Snapshot
- Test framework is Vitest with jsdom and Testing Library.
- Current full validation includes two known unrelated embedded-browser failures:
   - `src/main/proxy/__tests__/sen20-embedded-browser.test.js` session host-model expectation
   - `src/renderer/js/components/sentinel/__tests__/components.test.js` button label expectation (`Reload` vs current compact control labels)
- Current targeted backend and renderer suites pass, including SEN-018 through SEN-024 and project-store stability checks.
- Current renderer validation also covers the M9 workbench shell, dark-first theme tokens, and split-pane navigation flows.
- Post-build runtime validation (`npm run test:build`) also passes (3/3 dist smoke tests).
- Coverage/report strategy is documented in `TEST_COVERAGE.md`.

## Sentinel Scope Status
M1 through M9 capabilities are complete and implemented in this branch, including:

1. Core proxy pipeline (intercept, edit, forward, rules, history).
2. Manual tools (Repeater response viewers and request replay workflows).
3. Intruder automation (payload engines + result analytics).
4. Scope and target mapping with Burp/HackerOne import pipelines.
5. Decoder and embedded browser integration.
6. Advanced scanner/OOB/sequencer workflows.
7. Build validation layer testing for generated `dist/` artifacts.
8. Extension host, script automation runtime, and IPC/renderer hardening.
9. Workbench shell modernization: fixed viewport layout, activity bar, tab strip, virtualized proxy/history surfaces, Monaco-backed inspectors, buffered streaming, and dark-first semantic theming.
10. Project-level outbound proxy runtime controls for custom headers, tool identity header, and static source-IP pool rotation.

No planned milestone gaps remain through M9.

## Planned Changes (Roadmap)
Future work items are tracked in `ARCHITECTURE_MIGRATION_PLAN.md` and `VITE_MIGRATION_PLAN.md`. Both documents are **Future Roadmap** status — not started. Highlights:
- IPC handler extraction into domain modules (`src/main/proxy/proxy-ipc.js`, etc.)
- TLS/certificate validation hardening for the embedded browser session
- Native module ABI alignment (`@electron/rebuild` postinstall)
- Build pipeline migration from Gulp to Vite
- Console/terminal panel (`xterm.js` + `node-pty`) — see `CONSOLE_TERMINAL_PLAN.md`

## Security Notes
- Keep renderer free of direct Node.js imports.
- Expose privileged operations through `preload.js` only.
- Keep BrowserWindow security options explicit:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: true`

## Troubleshooting

### App fails to start

```bash
npx gulp clean
npx gulp build
npm run start
```

### App shows a blank white screen
- Rebuild before launch: `npm run build` then `npm run start`.
- Runtime launches from generated `dist/`; stale bundles can hide renderer fixes made in `src/`.
- A recent startup crash source (invalid tooltip component usage) has been corrected in `App.jsx`.

### UI changes not visible
- Confirm watch/build is running.
- Verify new artifacts in `dist/renderer/`.

### Main process changes not reflected
- Confirm `src/main/**` was copied to `dist/main/` by build/watch.

## Workbench UI Directive (Implemented)
The renderer now follows a fixed desktop-workbench architecture:

1. Shell layout uses fixed viewport (`h="100vh"`, `overflow="hidden"`) with collapsible panes.
2. Left activity bar provides quick switching for all modules and supports both collapsed (icons only) and expanded (icons + labels) states.
3. Main workspace uses a concurrent tab strip for module workflows.
4. Bottom status bar surfaces real-time engine status, active scans/tasks, and memory usage.
5. Proxy/history tables target high-density rendering and virtualization (`@tanstack/react-table` + `@tanstack/react-virtual` or `react-window`).
6. Request/response inspector roadmap includes Monaco-powered Raw view plus Headers/Raw/Preview tabs.
7. Renderer update cadence for high-frequency streams is buffered/throttled (100-200ms) to keep UI responsive.
8. Theme direction is dark-first with severity semantics: critical `red.600`, high `orange.500`, medium `yellow.400`, low `blue.400`, info `gray.400`.
