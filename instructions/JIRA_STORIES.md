# Sentinel — Jira Story Backlog

Stories are ordered by completion status (✅ Done → 🔲 Pending) then by milestone and priority.

Historical note: some story context sections preserve original planning-time wording (for example, references to stubs/TODOs) and are retained for traceability.

---

## ✅ Completed Stories

---

### SEN-001 · [DevEx]: As a developer, I want a Vitest test suite with coverage so that I can validate service stubs and renderer logic confidently.

#### 1. User Story Statement
As a **developer**
I want to run a fast, coverage-aware unit test suite
So that **I can catch regressions early and track how much code is exercised**

#### 2. Context / Background
Project started without any test infrastructure. Vitest was selected to match the ESM/JSX stack and provide v8 coverage without a separate runner.

Related Issues: SEN-002

#### 3. Acceptance Criteria
- [x] AC 1: `npm test` runs all tests with no manual configuration
- [x] AC 2: Coverage is collected via v8 provider and written to `coverage/`
- [x] AC 3: All 302 tests across 25 suites pass on a clean install
- [x] AC 4: Each proxy service stub has at least one test confirming it exports an object

#### 4. Technical Notes
- `vitest.config.js` with jsdom environment and `@testing-library/react`
- Test files under `src/main/__tests__/` and `src/renderer/__tests__/`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated (`TEST_COVERAGE.md`)

---

### SEN-002 · [DevEx]: As a developer, I want `.gitignore` set correctly so that build artifacts and tooling config are not committed.

#### 1. User Story Statement
As a **developer**
I want the `.gitignore` to exclude generated and local-only directories
So that **only source-controlled files appear in PRs and commit history**

#### 2. Context / Background
`dist/`, `node_modules/`, `.vscode/`, and `.github/` were being tracked or risked being tracked.

#### 3. Acceptance Criteria
- [x] AC 1: `/dist` is excluded
- [x] AC 2: `/node_modules` is excluded
- [x] AC 3: `/.vscode` and `/.github` are excluded
- [x] AC 4: No `coverage/` or test output directories are committed

#### 4. Technical Notes
Entries live at repo root `.gitignore`.

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-003 · [DevEx]: As a developer, I want unused packaging artifact folders removed so that the repository does not contain unreferenced third-party files.

#### 1. User Story Statement
As a **developer**
I want orphaned vendor folders purged from the repo
So that **the workspace is lean and build output is not polluted**

#### 2. Context / Background
`m/`, `mini/`, and `dom/` were `framer-motion` packaging artifacts with no imports in the app. Identified via directory scan.

#### 3. Acceptance Criteria
- [x] AC 1: `m/`, `mini/`, and `dom/` folders are deleted
- [x] AC 2: `npx gulp build` succeeds after deletion
- [x] AC 3: `npm run start` launches without errors after deletion

#### 4. Technical Notes
No source files imported these folders. Safe to delete.

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-004 · [Docs]: As a contributor, I want an accurate README so that I can understand the project structure, stack, and how to run it.

#### 1. User Story Statement
As a **new contributor**
I want a README that reflects the actual file tree, scripts, and tech stack
So that **I can onboard quickly without guessing at missing context**

#### 2. Context / Background
The original README did not reflect the Sentinel scope, planning items, or current component structure.

Related Issues: SEN-005

#### 3. Acceptance Criteria
- [x] AC 1: README shows the current `src/` file tree with TODO annotations on stubs
- [x] AC 2: Tech stack section lists Electron, React, Chakra UI, Gulp, Vitest
- [x] AC 3: Scripts (`dev`, `start`, `test`) are documented with their purpose
- [x] AC 4: TODO scope section lists the 10 outstanding sentinel implementation items
- [x] AC 5: Planned Changes roadmap highlights are present

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-005 · [Docs]: As a project lead, I want planning docs updated with Burp, HackerOne, and custom-script TODO items so that the full intended scope is tracked.

#### 1. User Story Statement
As a **project lead**
I want planning documents to record all three integration TODOs
So that **no intended scope item is missing from milestone planning**

#### 2. Context / Background
Burp Suite project config import, HackerOne CSV ingestion, and custom-script automation were identified as required features not yet in any planning doc.

Related Issues: SEN-004, SEN-016, SEN-017, SEN-018

#### 3. Acceptance Criteria
- [x] AC 1: `SENTINEL_IMPLEMENTATION_PLAN.md` contains Burp Suite import entry under M5
- [x] AC 2: `SENTINEL_IMPLEMENTATION_PLAN.md` contains HackerOne CSV ingestion under M5
- [x] AC 3: `SENTINEL_IMPLEMENTATION_PLAN.md` contains custom-script automation under M8
- [x] AC 4: `APP_COMPLETION_AND_TEST_CHECKLIST.md` mirrors all three additions

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-006 · [Renderer]: As a developer, I want the renderer entry point renamed from `app.jsx` to `main.jsx` so that it is unambiguous from the `App.jsx` root component.

#### 1. User Story Statement
As a **developer**
I want the bootstrapper file named `main.jsx` and the root UI component named `App.jsx`
So that **the distinction between entry point and root component is immediately clear**

#### 2. Context / Background
`app.jsx` and `App.jsx` coexisted. Renaming the lowercase entry to `main.jsx` follows React ecosystem conventions.

#### 3. Acceptance Criteria
- [x] AC 1: `src/renderer/js/app.jsx` is renamed to `src/renderer/js/main.jsx`
- [x] AC 2: `gulpfile.js` `jsEntry` points to `main.jsx`
- [x] AC 3: All doc references updated (`README`, checklists, instruction files)
- [x] AC 4: Build and tests pass after rename

#### 4. Technical Notes
`gulpfile.js` `paths.jsEntry` value updated.

#### 5. Definition of Done
- [x] Unit tests passed (127 passing)
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-007 · [Renderer/Shell]: As a security analyst, I want a Sentinel workspace shell so that I can navigate between security testing modules in a single window.

#### 1. User Story Statement
As a **security analyst**
I want module navigation, tabbed workspace panes, and global proxy status controls in the app shell
So that **I can move between modules and manage the proxy without losing context**

#### 2. Context / Background
`App.jsx` previously had only version info. The shell needed module buttons, pane strip, status badges, and a pause/resume proxy control.

Related Issues: SEN-008

#### 3. Acceptance Criteria
- [x] AC 1: Module navigation buttons render for Dashboard, Proxy, History, Repeater, Intruder, Target, Scanner, Decoder, Extensions
- [x] AC 2: Clicking a module opens or focuses a pane in the workspace strip
- [x] AC 3: Panes can be closed (minimum 1 pane enforced)
- [x] AC 4: Global status badges show proxy state (green/orange), project name, and scope mode
- [x] AC 5: Pause/Resume proxy toggle button changes badge color and label
- [x] AC 6: Sidebar shows Active Context and Planned Integrations cards

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally (app window renders without blank page)
- [x] Documentation updated

---

### SEN-008 · [Renderer/Panels]: As a developer, I want all 12 sentinel panel stubs converted to real React components so that the module navigation can render actual UI.

#### 1. User Story Statement
As a **developer**
I want each sentinel panel to be a proper exported React component
So that **the workspace shell can render the correct panel when a pane is selected**

#### 2. Context / Background
All 12 panel files were comment-only TODO stubs with no JSX. The shell's `React.createElement` call required real components.

Related Issues: SEN-007

#### 3. Acceptance Criteria
- [x] AC 1: All 12 panel files export a named React function component via `module.exports`
- [x] AC 2: Each panel renders a `<Heading>` and `<Text>` placeholder describing planned functionality
- [x] AC 3: `App.jsx` imports all active panels and renders via a `modulePanels` map
- [x] AC 4: Selecting a pane renders the correct panel component
- [x] AC 5: Build and 302 tests pass

#### 4. Technical Notes
Panels: `DashboardShell`, `ProxyPanel`, `HistoryPanel`, `RepeaterPanel`, `IntruderPanel`, `TargetMapPanel`, `ScannerPanel`, `DecoderPanel`, `ExtensionsPanel`, `EmbeddedBrowserPanel`, `OobPanel`, `SequencerPanel`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-009 · [Renderer/Shell]: As a security analyst, I want the sidebar status card to show panel-specific fields so that I always see relevant context for the active module.

#### 1. User Story Statement
As a **security analyst**
I want the Active Context sidebar card to reflect fields specific to whichever pane is open
So that **I can see proxy queue depth, scope count, or findings without switching panels**

#### 2. Context / Background
The sidebar previously showed generic fields (open panes count, active module name). Panel-specific fields make it contextually useful.

Related Issues: SEN-007

#### 3. Acceptance Criteria
- [x] AC 1: Each module has a defined set of status fields (label + state key)
- [x] AC 2: Switching panes updates the sidebar card to show that module's fields
- [x] AC 3: Default values are seeded from `defaultPanelStatus`
- [x] AC 4: Fields render as `<Code>` values alongside their labels
- [x] AC 5: Build succeeds

#### 4. Technical Notes
`panelStatusFields` and `defaultPanelStatus` objects defined in `App.jsx`. State held in `panelStatus` (`useState`). IPC updates will call `setPanelStatus(prev => ({ ...prev, [module]: newData }))`.

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-010 · [Bug]: As a user, I want the app window to render content on startup so that I am not presented with a blank screen.

#### 1. User Story Statement
As a **user**
I want the app to render the workspace shell on launch
So that **I can begin using the tool immediately without a blank-screen failure**

#### 2. Context / Background
`Divider` was removed in Chakra UI v3 (replaced by `Separator`). Using the removed import caused a silent React render error, leaving the window blank.

#### 3. Acceptance Criteria
- [x] AC 1: `Divider` import replaced with `Separator` in `App.jsx`
- [x] AC 2: `<Divider />` JSX replaced with `<Separator />` in the render output
- [x] AC 3: `npm run start` opens a fully rendered workspace shell with no console errors

#### 4. Technical Notes
Chakra UI v3 migration: `Divider` → `Separator`. Verified via `node -e "require('@chakra-ui/react')"` export check.

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally (`npm run start` exit code 0)
- [x] Documentation updated

---

### SEN-011 · [M0/Architecture]: As a tech lead, I want a locked IPC contract and traffic data model so that all feature modules build to the same interface.

#### 1. User Story Statement
As a **tech lead**
I want canonical types for HTTP traffic events and a versioned IPC contract map before any service coding begins
So that **feature modules do not need structural rewrites when integrated**

#### 2. Context / Background
No contracts exist yet. Milestone 0 gates all downstream milestones.

Related Issues: SEN-012, SEN-013

#### 3. Acceptance Criteria
- [x] AC 1: A canonical traffic model (request/response/WebSocket event) is defined and documented
- [x] AC 2: A full IPC contract map is published listing every channel, its direction, payload shape, and expected response
- [x] AC 3: A DB schema and migration version strategy is defined for project files
- [x] AC 4: No feature module begins implementation without confirmed contract alignment

#### 4. Technical Notes
- Relevant files: `src/main/index.js`, `src/main/preload.js`, `src/main/db/project-store.js`
- Contracts implemented under `src/contracts/` (traffic-model.js, ipc-contract.js, db-schema.js, index.js)
- Preload bridge scaffolded with all 14 service namespaces mapped to contract channels
- 35 new contract tests added; 162 tests total, all passing

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated


### SEN-012 · [M1/Platform]: As a developer, I want project persistence with crash-safe writes so that analyst work is never silently lost.

#### 1. User Story Statement
As a **developer**
I want a real-time project store backed by SQLite that survives crashes
So that **analysts do not lose rules, scope, history, or module state on unexpected exit**

#### 2. Context / Background
`src/main/db/project-store.js` now provides a SQLite-backed project store with migration bootstrap, incremental persistence APIs, and crash-safety configuration. All Sentinel modules depend on this persistence layer.

Related Issues: SEN-011, SEN-013

#### 3. Acceptance Criteria
- [x] AC 1: A project file is created on first launch and loaded on subsequent launches
- [x] AC 2: Traffic history, rules, scope, and module state are persisted incrementally
- [x] AC 3: Crash-safe write pattern (WAL mode or equivalent) is used
- [x] AC 4: Recovery integrity check runs on project load and reports corruption clearly
- [x] AC 5: Project file version is stored and migration strategy handles older versions

#### 4. Technical Notes
- `src/main/db/project-store.js`
- SQLite3 is already in `dependencies`
- WAL + `synchronous=FULL` enabled on open for crash-safety
- Integrity check executed with `PRAGMA quick_check` and explicit `PROJECT_DB_CORRUPT` error code on failure
- Added integration tests in `src/main/__tests__/project-store.test.js`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-013 · [M1/Platform]: As a developer, I want CA certificate generation and lifecycle management so that the proxy can perform TLS interception.

#### 1. User Story Statement
As a **developer**
I want the app to generate, store, and rotate a local CA certificate
So that **the proxy can perform TLS MITM and analysts can install the CA into their trust store**

#### 2. Context / Background
`src/main/certs/ca-manager.js` is a stub. TLS interception is a hard dependency of Milestone 2.

Related Issues: SEN-011, SEN-014

#### 3. Acceptance Criteria
- [x] AC 1: A CA key pair is generated on first run and persisted securely
- [x] AC 2: The CA certificate is exportable for user trust-store installation
- [x] AC 3: Per-host leaf certs are generated on demand and cached
- [x] AC 4: Rotation invalidates old leaf certs and regenerates the CA on request
- [x] AC 5: OS-specific trust installation guidance is surfaced in the UI

#### 4. Technical Notes
- `src/main/certs/ca-manager.js`
- Consider `node-forge` or native crypto for cert generation

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-014 · [M2/Proxy]: As a security analyst, I want an intercepting proxy so that I can pause, edit, and forward HTTP/S traffic.

#### 1. User Story Statement
As a **security analyst**
I want to intercept live browser traffic, edit requests before they are forwarded, and apply match/replace rules automatically
So that **I can inspect and manipulate web application traffic for security testing**

#### 2. Context / Background
Core Sentinel MVP capability. Implemented in current branch with queue-based pause/edit/forward/drop controls, automatic rule application, and HTTP/1.1 interception.

Related Issues: SEN-011, SEN-012, SEN-013, SEN-015

#### 3. Acceptance Criteria
- [x] AC 1: HTTP/1.1 traffic flowing through the configured proxy port is intercepted
- [x] AC 2: The ProxyPanel UI shows intercepted requests in a queue
- [x] AC 3: Analyst can edit a request in the panel and forward the modified version
- [x] AC 4: Analyst can drop a request entirely
- [x] AC 5: Global pause/resume toggle stops all forwarding and resumes it
- [x] AC 6: Match/replace rules are applied automatically before forwarding
- [x] AC 7: All traffic is logged to the history store with request and response

#### 4. Technical Notes
- `src/main/proxy/intercept-engine.js`, `protocol-support.js`, `rules-engine.js`, `history-log.js`
- `src/renderer/js/components/sentinel/ProxyPanel.jsx`, `HistoryPanel.jsx`
- `http-mitm-proxy` is already in `dependencies`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-015 · [M2/Proxy]: As a security analyst, I want searchable traffic history so that I can find and inspect earlier requests across a session.

#### 1. User Story Statement
As a **security analyst**
I want all proxied traffic stored and searchable by host, path, status, and method
So that **I can revisit any captured request without it scrolling off screen**

#### 2. Context / Background
`history-log.js` now persists request/response pairs, supports paginated filtering (host/path/method/status), and powers direct handoff to repeater/intruder bridge services.

Related Issues: SEN-014

#### 3. Acceptance Criteria
- [x] AC 1: Every proxied request/response pair is written to the history store
- [x] AC 2: HistoryPanel renders a paginated, filterable list of captured items
- [x] AC 3: Filter supports host, path prefix, HTTP method, and status code
- [x] AC 4: History persists across app restart
- [x] AC 5: Analyst can send any history item to Repeater or Intruder directly

#### 4. Technical Notes
- `src/main/proxy/history-log.js`, `src/renderer/js/components/sentinel/HistoryPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-016 · [M3/Repeater]: As a security analyst, I want to replay and modify captured requests so that I can manually probe endpoints repeatedly.

#### 1. User Story Statement
As a **security analyst**
I want to load any captured request into a Repeater tab, edit it, send it, and inspect the response in Raw, Hex, or Rendered mode
So that **I can iteratively test inputs and observe responses without resetting browser state**

#### 2. Context / Background
`repeater-service.js` is a stub. Depends on history (SEN-015).

Related Issues: SEN-015

#### 3. Acceptance Criteria
- [x] AC 1: Any history item can be sent to a new Repeater tab
- [x] AC 2: Analyst can edit method, path, headers, and body before sending
- [x] AC 3: Response is displayed in Raw, Hex, and Rendered tabs
- [x] AC 4: Each send is stored in the Repeater item's local history
- [x] AC 5: Side-by-side diff view between two Repeater responses is available

#### 4. Technical Notes
- `src/main/proxy/repeater-service.js`, `src/renderer/js/components/sentinel/RepeaterPanel.jsx`
- `forwardRequest` extracted from `protocol-support.js` as shared forwarding primitive
- `rawBodyBase64` on all responses enables Hex viewer tab without Buffer over IPC
- IPC contract bumped to schema v4 (`repeater:get` channel added)
- 9 integration tests in `src/main/proxy/__tests__/sen16-repeater.test.js`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-017 · [M4/Intruder]: As a security analyst, I want an automated payload attack engine so that I can brute-force and fuzz web application inputs.

#### 1. User Story Statement
As a **security analyst**
I want to define payload positions on a captured request, select a payload source, run an attack, and triage results by anomaly indicators
So that **I can efficiently enumerate and identify vulnerable input parameters**

#### 2. Context / Background
`intruder-engine.js` now runs real payload attacks against marked request templates, streams progress over IPC, and stores sortable/anomaly-aware results. Depends on history handoff and the shared forwarding primitive from SEN-016.

Related Issues: SEN-016

#### 3. Acceptance Criteria
- [x] AC 1: Analyst can mark one or more positions in a request template
- [x] AC 2: Payload sources: dictionary file, brute-force charset, sequential numeric
- [x] AC 3: Attack profiles: single-point, pitchfork, cluster bomb
- [x] AC 4: Attack progress is shown with a live results table
- [x] AC 5: Results are sortable/filterable by status code, response length, and response time
- [x] AC 6: Anomalous results are highlighted automatically based on baseline deviation

#### 4. Technical Notes
- `src/main/proxy/intruder-engine.js`, `src/renderer/js/components/sentinel/IntruderPanel.jsx`
- `src/main/index.js`, `src/main/preload.js`, `src/contracts/ipc-contract.js`, `src/renderer/js/components/sentinel/HistoryPanel.jsx`
- Marker-based request templating uses `§value§` placeholders with per-position payload sources.
- Intruder runtime emits `intruder:progress` and exposes `intruder:list` for panel/history integration.
- Tests: `src/main/proxy/__tests__/sen17-intruder.test.js` (8 backend tests), `src/renderer/js/components/sentinel/__tests__/IntruderPanel.real.test.jsx` (3 panel interaction tests).

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-018 · [M5/Target]: As a security analyst, I want scope management with Burp and HackerOne import so that I can define and enforce target boundaries quickly.

#### 1. User Story Statement
As a **security analyst**
I want to define scope by host/domain/CIDR, import it from Burp project configs or HackerOne CSV exports, and have all automation modules respect those boundaries
So that **I stay within authorised target scope and avoid testing out-of-scope assets**

#### 2. Context / Background
`target-mapper.js` and `TargetMapPanel.jsx` now provide scope CRUD, Burp/HackerOne imports, persistence wiring, and sitemap visibility.

Related Issues: SEN-014

#### 3. Acceptance Criteria
- [x] AC 1: Analyst can add/remove scope entries by host, domain, IP, or CIDR range
- [x] AC 2: A site tree is generated from observed traffic and displays in/out of scope visually
- [x] AC 3: Burp Suite project configuration XML/JSON can be imported and scope rules extracted
- [x] AC 4: HackerOne CSV program exports can be ingested with field mapping and validation
- [x] AC 5: Imported include/exclude rules persist across restart
- [x] AC 6: All automation modules (scanner, intruder, rules engine) check scope before acting
- [x] AC 7: Out-of-scope items are visibly flagged in the UI

#### 4. Technical Notes
- `src/main/proxy/target-mapper.js`, `src/main/db/project-store.js`
- `src/renderer/js/components/sentinel/TargetMapPanel.jsx`, `DashboardShell.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-019 · [M6/Decoder]: As a security analyst, I want a chained decoder so that I can transform and reverse payloads in a single workflow.

#### 1. User Story Statement
As a **security analyst**
I want to paste arbitrary input, apply one or more transforms (Base64, URL, HTML, Hex, GZIP), and step through the chain in either direction
So that **I can quickly decode obfuscated values or construct encoded payloads for testing**

#### 2. Context / Background
`decoder-service.js` now supports chained transforms, reverse replay, and recursive processing with intermediate step output for renderer workflows.

Related Issues: SEN-011

#### 3. Acceptance Criteria
- [x] AC 1: Decoder supports Base64 encode/decode, URL encode/decode, HTML entity encode/decode, Hex, and GZIP
- [x] AC 2: Multiple transforms can be chained and applied in sequence
- [x] AC 3: Chain is reversible — analyst can decode a value back through the same chain
- [x] AC 4: Each step in the chain shows intermediate output
- [x] AC 5: DecoderPanel renders the input area, step chain, and output area

#### 4. Technical Notes
- `src/main/proxy/decoder-service.js`, `src/renderer/js/components/sentinel/DecoderPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-020 · [M6/Browser]: As a security analyst, I want an embedded browser routed through the proxy so that I can browse targets without reconfiguring an external browser.

#### 1. User Story Statement
As a **security analyst**
I want to launch an embedded browser session that automatically routes all traffic through the Sentinel proxy
So that **I can browse, authenticate, and capture traffic without external browser proxy setup**

#### 2. Context / Background
`embedded-browser-service.js` now manages sessions and routes address-bar navigation through the running Sentinel proxy listener.

Related Issues: SEN-014

#### 3. Acceptance Criteria
- [x] AC 1: Embedded browser opens within the EmbeddedBrowserPanel
- [x] AC 2: All embedded browser traffic is routed through the configured proxy listener
- [x] AC 3: Browser sessions appear in traffic history automatically
- [x] AC 4: Analyst can navigate to a URL from the panel's address bar

#### 4. Technical Notes
- `src/main/proxy/embedded-browser-service.js`, `src/renderer/js/components/sentinel/EmbeddedBrowserPanel.jsx`
- Electron `BrowserView` or `webview` tag (sandboxed)

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified locally
- [x] Documentation updated

---

### SEN-021 · [M7/Scanner]: As a security analyst, I want passive and active scanning so that I can identify common vulnerabilities automatically.

#### 1. User Story Statement
As a **security analyst**
I want the scanner to passively flag header/hygiene issues on observed traffic and actively probe for SQLi, XSS, and SSRF when triggered
So that **I get automated vulnerability signals without replaying every request manually**

#### 2. Context / Background
`scanner-engine.js` implements passive checks, active probes, scope gating, and finding persistence. Depends on history (SEN-015) and scope enforcement (SEN-018).

Related Issues: SEN-015, SEN-018

#### 3. Acceptance Criteria
- [x] AC 1: Passive scanner runs automatically on all history items and flags security header issues, information disclosure, and cookie attribute deficiencies
- [x] AC 2: Active scanner can be triggered per-item or per-scope against selected hosts
- [x] AC 3: Active checks include SQL injection, reflected XSS, and SSRF primitives
- [x] AC 4: ScannerPanel shows a findings list with severity, description, and HTTP evidence
- [x] AC 5: Scanner respects scope rules and will not probe out-of-scope hosts
- [x] AC 6: Findings persist to the project store

#### 4. Technical Notes
- `src/main/proxy/scanner-engine.js`, `src/renderer/js/components/sentinel/ScannerPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-022 · [M7/OOB]: As a security analyst, I want OOB callback tracking so that I can detect blind injection vulnerabilities.

#### 1. User Story Statement
As a **security analyst**
I want out-of-band probe payloads generated that phone home to a listener, with callbacks correlated back to the originating request
So that **I can confirm blind SSRF, blind XSS, and blind XXE without relying on response differences**

#### 2. Context / Background
`oob-service.js` implements payload generation, callback listener capture, and correlation metadata. Depends on scanner (SEN-021).

Related Issues: SEN-021

#### 3. Acceptance Criteria
- [x] AC 1: Unique OOB payload URLs are generated per probe
- [x] AC 2: A callback listener records incoming connections with timestamp, source, and payload token
- [x] AC 3: Callbacks are correlated to originating scanner/intruder probes in the UI
- [x] AC 4: OobPanel shows all received callbacks with linked source requests

#### 4. Technical Notes
- `src/main/proxy/oob-service.js`, `src/renderer/js/components/sentinel/OobPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-023 · [M7/Sequencer]: As a security analyst, I want token entropy analysis so that I can assess the predictability of session tokens.

#### 1. User Story Statement
As a **security analyst**
I want to collect a sample of tokens from a target, run entropy and predictability analysis, and receive a clear analyst summary
So that **I can identify weak session token generation without manual statistical analysis**

#### 2. Context / Background
`sequencer-service.js` implements capture sessions, replay sampling, entropy checks, and exportable reports. Depends on history and repeater for token collection.

Related Issues: SEN-016

#### 3. Acceptance Criteria
- [x] AC 1: Analyst can select a token field from a captured response (cookie, header, body)
- [x] AC 2: Sequencer collects a configurable sample size by replaying the originating request
- [x] AC 3: Entropy metrics (bit strength, character distribution, FIPS 140-2 tests) are calculated
- [x] AC 4: SequencerPanel renders a summary with a pass/fail rating and raw metrics
- [x] AC 5: Results are exportable

#### 4. Technical Notes
- `src/main/proxy/sequencer-service.js`, `src/renderer/js/components/sentinel/SequencerPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-024 · [M8/Extensions]: As a developer, I want an extension host with a safe API so that third-party tools can integrate with Sentinel without breaking security boundaries.

#### 1. User Story Statement
As a **developer or power user**
I want to load and unload extensions that can hook into proxy events, scanner findings, and scope transitions using a defined API
So that **Sentinel can be extended with custom workflows without modifying core code**

#### 2. Context / Background
`extension-host.js` now provides a VM-isolated extension runtime with permission approval, event subscriptions, timeout watchdog execution, and structured audit logs surfaced in `ExtensionsPanel`.

Related Issues: SEN-011

#### 3. Acceptance Criteria
- [x] AC 1: Extensions are loaded from a designated directory and listed in ExtensionsPanel
- [x] AC 2: Each extension declares required permissions; user approves on load
- [x] AC 3: Extensions can subscribe to proxy intercept, scanner finding, and scope transition events
- [x] AC 4: Extensions run in an isolated context with a timeout watchdog
- [x] AC 5: Extension unload is clean and does not leave dangling listeners
- [x] AC 6: An audit log records all extension-triggered actions

#### 4. Technical Notes
- `src/main/proxy/extension-host.js`, `src/renderer/js/components/sentinel/ExtensionsPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-025 · [M8/Automation]: As a power user, I want a custom-script automation runtime so that I can define trigger-based actions without writing a full extension.

#### 1. User Story Statement
As a **power user**
I want to write lightweight scripts that fire on proxy intercept events, scanner findings, or scope transitions — with sandboxed execution, permission controls, and an audit log
So that **I can automate repetitive testing workflows without modifying the core application**

#### 2. Context / Background
Custom-script automation is implemented as a lightweight script runtime built on the extension host (SEN-024), with trigger mapping, sandbox execution, permission gating, timeout watchdogs, and shared audit logging.

Related Issues: SEN-024

#### 3. Acceptance Criteria
- [x] AC 1: Analyst can write and save scripts attached to one or more trigger types
- [x] AC 2: Scripts execute in a sandboxed runtime (no direct Node.js `require` for sensitive modules)
- [x] AC 3: Script execution is gated by explicit user-defined permissions
- [x] AC 4: A configurable timeout kills hanging scripts and logs the failure
- [x] AC 5: All script executions are recorded in a structured audit log visible in the UI
- [x] AC 6: Scripts can read request/response data and emit findings or modified values

#### 4. Technical Notes
- `src/main/proxy/extension-host.js` (shared runtime), `src/renderer/js/components/sentinel/ExtensionsPanel.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-026 · [M8/Hardening]: As a developer, I want a security hardening pass on IPC and renderer boundaries so that the app meets production security standards.

#### 1. User Story Statement
As a **developer**
I want to audit all IPC channels in preload, verify renderer boundary isolation, and resolve any OWASP-relevant issues before release
So that **Sentinel itself is not a vector for privilege escalation or code injection**

#### 2. Context / Background
`preload.js` now exposes a contract-mapped API surface with channel validation tests, while `index.js` enforces secure BrowserWindow flags and extension/script runtime boundaries. M8 hardening focuses on strict IPC mapping, input validation at handlers, and renderer boundary safety.

Related Issues: SEN-011, SEN-014

#### 3. Acceptance Criteria
- [x] AC 1: All IPC channels are enumerated and each has a documented security rationale
- [x] AC 2: No renderer-accessible API allows arbitrary code execution or file system access beyond project scope
- [x] AC 3: Input validation and sanitisation are applied at all IPC boundary entry points
- [x] AC 4: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` are verified and enforced in production build
- [x] AC 5: A security review checklist is completed and signed off

#### 4. Technical Notes
- `src/main/preload.js`, `src/main/index.js`
- Reference OWASP Electron Security Checklist

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-043 · [UI/Workbench]: As a security analyst, I want a fixed-viewport workbench shell so that I can run multiple tools without losing screen space.

#### 1. User Story Statement
As a **security analyst**
I want a fixed desktop-style shell with an activity bar, tabbed workspace, collapsible panes, and a status bar
So that **I can manage concurrent testing workflows in one responsive interface**

#### 2. Context / Background
The current shell supports module panes but needs a dedicated workbench layout standard (fixed viewport and collapsible regions) for high-density traffic workflows.

Related Issues: SEN-007, SEN-044

#### 3. Acceptance Criteria
- [x] AC 1: Root renderer shell uses fixed viewport (`h="100vh"`) and disables page scrolling (`overflow="hidden"`)
- [x] AC 2: Left activity bar is implemented for all modules with quick actions and collapsed/expanded readability modes
- [x] AC 3: Main workspace supports concurrent tabs through a persistent tab strip
- [x] AC 4: Sidebar panels can be collapsed and expanded while preserving state
- [x] AC 5: Bottom status bar displays engine state, active scans/tasks, and memory usage

#### 4. Technical Notes
- `src/renderer/js/components/App.jsx`, `src/renderer/js/components/sentinel/DashboardShell.jsx`
- Keep renderer code browser-only and preload-driven for privileged operations

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-044 · [UI/ProxyLog]: As a security analyst, I want a virtualized high-density proxy log so that the UI stays fast with very large traffic captures.

#### 1. User Story Statement
As a **security analyst**
I want the proxy/history list to render thousands of rows efficiently with compact formatting
So that **I can inspect large captures without scroll lag or dropped frames**

#### 2. Context / Background
Proxy and history surfaces will exceed 10,000 items during long sessions; full DOM rendering and unwindowed state updates are not acceptable.

Related Issues: SEN-015, SEN-043, SEN-046

#### 3. Acceptance Criteria
- [x] AC 1: Table/list surface uses `@tanstack/react-table` with `react-window`
- [x] AC 2: Key columns (Host, Path) use compact monospaced styling (`fontFamily="mono"`, `fontSize="xs"`, compact padding)
- [x] AC 3: Dataset of 10,000+ rows remains responsive during scroll and selection
- [x] AC 4: Row selection opens detail inspector without full table re-render pressure on the whole surface
- [x] AC 5: Performance validation notes are captured in test/build notes

#### 4. Technical Notes
- `src/renderer/js/components/sentinel/HistoryPanel.jsx`, `src/renderer/js/components/sentinel/ProxyPanel.jsx`
- Prefer stable row model and isolated selected-row state

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-045 · [UI/Inspector]: As a security analyst, I want an advanced request/response inspector so that I can analyze traffic with protocol-aware views.

#### 1. User Story Statement
As a **security analyst**
I want a tabbed inspector with Headers, Raw, and Preview/Hex modes plus repeater handoff
So that **I can quickly inspect and pivot requests into manual replay workflows**

#### 2. Context / Background
Current inspector surfaces are functional but lack Monaco-based raw editing and structured sub-view navigation expected in a professional security workbench.

Related Issues: SEN-016, SEN-043, SEN-044

#### 3. Acceptance Criteria
- [x] AC 1: Raw view uses `@monaco-editor/react` with syntax highlighting for HTTP/JSON/HTML
- [x] AC 2: Inspector provides sub-tabs for Headers, Raw, and Preview/Hex
- [x] AC 3: Headers view renders key-value pairs in a compact table
- [x] AC 4: "Send to Repeater" pushes selected request into shared state and opens/focuses a repeater tab
- [x] AC 5: Inspector updates are isolated from the list virtualization path

#### 4. Technical Notes
- `src/renderer/js/components/sentinel/HistoryPanel.jsx`, `src/renderer/js/components/sentinel/RepeaterPanel.jsx`
- Any shared state integration should remain preload-safe and deterministic

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-046 · [UI/Streaming]: As a security analyst, I want buffered IPC streaming so that high-throughput capture does not freeze the renderer.

#### 1. User Story Statement
As a **security analyst**
I want main-process event streaming with throttled renderer updates
So that **traffic capture and scanning remain responsive under heavy load**

#### 2. Context / Background
Per-event React updates at high capture rates can cause excessive re-renders and memory churn. Streaming and buffered flush windows are required.

Related Issues: SEN-014, SEN-021, SEN-044

#### 3. Acceptance Criteria
- [x] AC 1: High-volume proxy/scanner events are emitted from main process and subscribed in renderer via preload (`ipcRenderer.on`)
- [x] AC 2: Renderer applies buffered/throttled updates with 100-200ms flush cadence (default target 150ms)
- [x] AC 3: Top-level renderer state avoids unbounded arrays for live feeds
- [x] AC 4: Burst traffic test confirms UI remains interactive while events stream
- [x] AC 5: Channel contracts document incremental payload shapes (no full-dataset pushes)

#### 4. Technical Notes
- `src/main/index.js`, `src/main/preload.js`, `src/contracts/ipc-contract.js`
- `src/renderer/js/components/sentinel/HistoryPanel.jsx`, `src/renderer/js/components/App.jsx`

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated

---

### SEN-047 · [UI/Theme]: As a security analyst, I want a dark-first semantic theme so that severity and risk signals are clear at a glance.

#### 1. User Story Statement
As a **security analyst**
I want an industrial dark theme with explicit severity semantics and command navigation
So that **I can interpret findings quickly in a consistent workbench aesthetic**

#### 2. Context / Background
Theme needs a security-tool visual baseline: dark default, reduced radius, severity color tokens, and rapid keyboard navigation.

Related Issues: SEN-043, SEN-045

#### 3. Acceptance Criteria
- [x] AC 1: Chakra theme defaults to a dark-first workbench palette
- [x] AC 2: Severity semantic tokens are defined: critical, high, medium, low, and info
- [x] AC 3: Global border radius is reduced (`sm` or none)
- [x] AC 4: Surface palette uses deep neutral workbench surfaces for canvas and panels
- [x] AC 5: Command palette (`Ctrl+K`) is available for module navigation

#### 4. Technical Notes
- `src/renderer/js/theme.js`, `src/renderer/js/components/App.jsx`
- Keep semantic token naming stable for scanner/intruder severity reuse

#### 5. Definition of Done
- [x] Unit tests passed
- [x] Code reviewed
- [x] QA verified in Staging
- [x] Documentation updated
