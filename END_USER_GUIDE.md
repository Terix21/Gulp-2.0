# Sentinel End-User Guide

> **Version: 1.0 — Current as of 2026-04-06 (M1–M9 complete)**

## What This App Is
Sentinel is a desktop web-security workbench for capturing, inspecting, replaying, and analyzing HTTP traffic.

## Quick Start
1. Install dependencies:
   - `npm install`
2. Build the app:
   - `npm run build`
3. Start the desktop app:
   - `npm run start`

If you update source files under `src/`, run `npm run build` again before relaunching.

## Main Layout
The UI is a workbench with five core areas:
1. Left module rail: open Sentinel modules (Dashboard, Proxy, History, Repeater, Intruder, Target, Scanner, OOB, Sequencer, Decoder, Embedded Browser, Extensions).
2. Top toolbar: runtime status, Settings menu, and quick actions.
3. Center workspace: active module tab content.
4. Right context rail: active-pane context and quick actions.
5. Bottom status bar: runtime metrics (engine state, tab count, memory, runtime versions).

## Settings and Themes
Open Settings from the toolbar:
1. Click `Settings`.
2. Open `Preferences`.
3. Choose a theme in `Theme Options`.
4. Configure global proxy forwarding behavior in `Proxy Runtime Settings`.

Theme groups:
- Dark themes: 5 options
- Light themes: 5 options

Theme changes apply across:
- Shell surfaces and text
- Toolbar and context rail controls
- Monaco editors in Proxy/History inspectors
- Status and feedback messages
- Command palette overlay

Proxy runtime settings apply across outbound traffic:
- Custom headers: add one header per line (`Header-Name: value`) and save.
- Tool identifier header: enable/disable and set custom name/value.
- Static source IP pool: add one IP per line (or comma-separated); requests rotate through configured IPs.

## Keyboard Shortcut
- Command palette toggle: `Ctrl+K`

## Module Guide

### Dashboard
Shows high-level workbench metrics and guidance cards.

### Proxy
Use for live interception:
1. Start/stop listener.
2. Toggle intercept mode.
3. Select paused requests.
4. Edit and forward/drop.
5. Send request to Repeater.
6. Configure and save runtime forwarding settings (custom headers, tool identifier header, static source IP list).

### History
Use for stored traffic:
1. Filter by host/path/method/status.
2. Inspect request/response details.
3. Switch inspector tabs (Headers/Raw/Preview/Hex).
4. Send selected item to Repeater or Intruder.

### Repeater
Use for manual replay:
1. Edit method/URL/headers/body.
2. Send request.
3. Review response in Raw/Hex/Rendered views.
4. Compare multiple sends side-by-side.

### Intruder
Use for payload automation:
1. Insert `§marker§` positions in URL/headers/body.
2. Choose payload source per position (dictionary, brute-force, sequential).
3. Select attack profile (sniper, pitchfork, cluster-bomb).
4. Start attack and review live results.

### Target Map
Use for scope control:
1. Add include/exclude rules.
2. Import scope from Burp files or CSV.
3. Review in-scope/out-of-scope sitemap.

### Scanner
Use for vulnerability checks:
1. Run active scans on targets.
2. Load passive findings.
3. Review findings by severity and evidence.

### OOB
Use for out-of-band testing:
1. Generate OOB payload.
2. Track callback hits.
3. Review correlation to source scan/request IDs.

### Sequencer
Use for token analysis:
1. Start capture session.
2. Analyze entropy/summary.
3. Export CSV report.

### Decoder
Use for chained transforms:
1. Configure operation chain (Base64/URL/HTML/Hex/GZIP).
2. Run forward or reverse chain.
3. Review intermediate step outputs.

### Embedded Browser
Use for proxied in-app browsing:
1. Create session.
2. Enter URL.
3. Navigate through proxy and inspect preview.

### Extensions
Use for extension/script automation:
1. Install package extension or automation script.
2. Enable/disable/uninstall entries.
3. Review audit log events.

## Common Troubleshooting

### App starts but UI changes are missing
1. Rebuild: `npm run build`
2. Restart app: `npm run start`

### Blank or stale UI
1. Run: `npm run clean`
2. Rebuild: `npm run build`
3. Relaunch: `npm run start`

### Theme changed but editor looked wrong
Monaco inspector themes follow selected light/dark mode. If you still see stale visuals:
1. Rebuild (`npm run build`)
2. Restart the app

### A module action fails
1. Check message shown at bottom of panel.
2. Use Refresh/Reload controls in that module.
3. If needed, restart app after rebuild.

### Proxy runtime settings did not apply
1. Open `Settings` -> `Proxy Runtime Settings` and click `Save`.
2. Confirm header format is `Name: value` (lines without `:` are ignored).
3. Confirm static IP entries are valid routable/local addresses for your host.
4. Re-send traffic after saving.

## Safety Notes
- Renderer module UI does not require direct Node.js access.
- Privileged operations are exposed through preload APIs.
- Runtime security defaults remain enabled (`contextIsolation`, `nodeIntegration: false`, `sandbox`).
