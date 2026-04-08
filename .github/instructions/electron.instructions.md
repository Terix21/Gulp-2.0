# Electron Instructions

## Scope
electron

## Version
^41.1.0

## Conventions
- **Main vs. Renderer:** Keep main process code in `src/main` and renderer process code in `src/renderer`.
- **IPC:** Use `ipcMain` and `ipcRenderer` for communication between processes.
- **Security:** Enable `contextIsolation` and `nodeIntegration: false` in `BrowserWindow` options.

## Common Patterns
- **Singleton Window:** Ensure only one instance of the main window is created.
- **Menu Bar:** Create a custom menu bar for the application.

## Pitfalls
- **Blocking the Main Process:** Avoid long-running tasks in the main process.
- **Insecure Content:** Be careful when loading remote content.

## Append-Only Updates
- 2026-04-02: For high-throughput proxy/scanner events, keep capture and analysis in main process services and stream compact progress/result events to renderer via preload subscriptions.
- 2026-04-02: Prefer event-driven channels (`ipcMain` + `webContents.send` / `ipcRenderer.on`) over tight polling loops for live logs.
- 2026-04-02: Renderer update cadence should be buffered/throttled at 100-200ms to prevent UI lockups under burst traffic.
- 2026-04-07: IPC handlers extracted from `index.js` into `src/main/proxy/proxy-ipc.js` and `src/main/proxy/browser-ipc.js`. Each exports a `register*Handlers(ipcMain, deps)` function. `browser-ipc.js` owns embedded browser view state and returns `{ syncHost, destroyAllViews }` lifecycle hooks. `index.js` is the composition root — it constructs deps and calls each register function during `app.whenReady()`.
