# React Instructions

## Scope
react

## Conventions
- Keep renderer entry at `src/renderer/js/main.jsx`.
- Keep reusable UI units under `src/renderer/js/components/`.
- Prefer function components and keep component responsibilities focused.
- Keep renderer code browser-safe (no direct Node.js API usage).
- Use Chakra UI as the primary component/styling system in renderer code.

## Common Patterns
- Use `react-dom/client` `createRoot` to mount app into `<div id="root"></div>`.
- Wrap app with `ChakraProvider` at renderer root.
- Export components with CommonJS (`module.exports`) to match repository module style.
- Render small composable components and pass explicit props.

## Pitfalls
- Do not bypass React with direct DOM mutation for component-managed UI.
- Do not introduce renderer-side privileged access; use preload bridges only.
- Ensure Vite bundling includes `.jsx` and module imports.

## Append-Only Updates

### M2+: Workbench & High-Performance Patterns
- **Layout:** Use fixed-viewport `Flex/Grid` (h="100vh", overflow="hidden") for workspace shell. Implement Activity Bar (left nav), Tabbed Workspace (concurrent panes), Status Bar (bottom).
- **Virtualization:** For large lists (proxy history, scan results), use `@tanstack/react-table` + `react-window` or `@tanstack/react-virtual`. Only render visible rows.
- **Master-Detail UX:** Clicking a table row opens an Inspector panel without re-rendering the table. Keep row state separate from detail data.
- **Windowed State:** For lists >500 items, keep only the visible window in React state; fetch older items on-demand from the database.
- **Throttled Updates:** Buffer high-frequency IPC events (history:push, scanner:progress) and flush every 100-200ms. Apply via custom hook to prevent React thrashing.
- **Monaco Integration:** Use `@monaco-editor/react` for request/response body inspection with syntax highlighting (HTTP, JSON, HTML, XML, JS).
- **Dark Mode:** Set Chakra `initialColorMode="dark"` and store preference in project metadata. Use custom severity palette (critical=red, high=orange, medium=yellow, low=blue, info=gray).
- **Performance Goals:** Target <50ms first paint after UI update, 60fps scroll, <500MB memory (steady state). Profile with React DevTools and Chrome DevTools.
- **IPC Patterns:** Prefer `ipcRenderer.on` push events over `ipcRenderer.invoke` polling. Never store large arrays directly in top-level `useState`; use buffered or windowed patterns.
- 2026-04-02: HistoryPanel pattern now uses server-side pagination + explicit filter apply (host/path/method/status) and row actions that call preload-safe handoff methods (`history:get` -> `repeater:send` / `intruder:configure`).
- 2026-04-02: Workbench shell directive requires fixed viewport root (`h="100vh"`, `overflow="hidden"`), activity bar navigation, tabbed concurrent workspace, collapsible sidebars, and bottom status bar metrics.
- 2026-04-02: Proxy log/traffic views should standardize on `@tanstack/react-table` + virtualization (`@tanstack/react-virtual` or `react-window`) with compact density (`fontFamily="mono"`, `fontSize="xs"`, `py={1}`, `px={2}`).
- 2026-04-02: Request/response inspector should use Monaco for Raw mode and provide Headers/Raw/Preview (or Hex) tab groups.
- 2026-04-02: Repeater handoff should push request objects into shared app state and open a dedicated repeater tab without blocking the list surface.

### Theme System: CSS Variable Contract (2026-04-11)
- `applyThemeToDocument(themeId)` in `App.jsx` is the single authoritative theme applier. It writes `--sentinel-*` CSS custom properties to `<html>` and sets `data-theme` (light/dark) and `data-sentinel-theme-id`. Never duplicate this logic in components.
- Chakra semantic tokens (`fg.default`, `fg.muted`, `bg.canvas`, `bg.panel`, `bg.surface`, `bg.subtle`, `bg.elevated`, `border.default`, `border.subtle`) are backed by `var(--sentinel-*)` variables and are the preferred way to reference theme colors in JSX props.
- For inline `style` objects (where Chakra tokens don't resolve), use the raw CSS variable: `style={{ color: 'var(--sentinel-fg-default)', background: 'var(--sentinel-bg-surface)' }}`.
- Adding a new theme requires only a new entry in `THEME_REGISTRY` with the full color map. No component code changes are needed as long as components use semantic tokens.

### Theme System: Form Input Visibility (2026-04-11)
- `Input`, `Textarea`, and `Select` components do **not** inherit text/background color from the Chakra theme automatically in Chakra v3 — they fall back to browser-agent styles in some contexts. Always supply explicit props:
  ```jsx
  <Textarea color='fg.default' bg='bg.surface' borderColor='border.default' />
  <Input color='fg.default' bg='bg.surface' borderColor='border.default' />
  ```
- Never use `color='black'` or `color='white'` on form fields. When one theme token covers all cases, prefer `color='fg.default'`.

### Theme System: Sidebar and Nav Rail Contrast (2026-04-11)
- Activity bar icons and nav-item labels must use `color='fg.default'` for the active state and `color='fg.muted'` for the inactive state — never static hex.
- Selected/active nav items should use `bg='bg.subtle'`; hover state should use `bg='bg.surface'` to ensure they remain visually distinct across all 10 themes.
- Panel borders that separate the activity bar, sidebar, and workspace area must reference `borderColor='border.default'` so they are visible in both dark and light modes.

### Theme System: Overlay and Quick-Action Panel Borders (2026-04-11)
- Right-hand contextual panels ("Active Context", "Quick Actions", or any flyout) must have a meaningful background shift: use `bg='bg.panel'` with `borderWidth='1px'` and `borderColor='border.default'` as minimum contrast markers on dark themes like Steel and Circuit.
- Use `getOverlayScrim(themeId)` from `theme-utils.js` when rendering modal-style scrim overlays rather than hardcoding an rgba value.

### Theme System: Scrollbars (2026-04-11)
- Apply scrollbar styling via the `::-webkit-scrollbar` family on the `data-theme` attribute so it automatically tracks the active theme mode:
  ```css
  [data-theme='dark'] ::-webkit-scrollbar { width: 6px; height: 6px; }
  [data-theme='dark'] ::-webkit-scrollbar-track { background: var(--sentinel-bg-canvas); }
  [data-theme='dark'] ::-webkit-scrollbar-thumb { background: var(--sentinel-border-subtle); border-radius: 3px; }
  [data-theme='light'] ::-webkit-scrollbar-track { background: var(--sentinel-bg-subtle); }
  [data-theme='light'] ::-webkit-scrollbar-thumb { background: var(--sentinel-border-default); border-radius: 3px; }
  ```
- Keep these rules in `src/renderer/scss/style.scss`. Do not scope them to individual component classes.

### Theme System: Root data-theme Verification (2026-04-11)
- After `applyThemeToDocument` runs, confirm `document.documentElement.dataset.theme` equals `'dark'` or `'light'`. Chakra's `colorMode` must be kept in sync with this value if Chakra's `useColorModeValue` hook is used anywhere — do not mix independent color-mode states.
- If a component uses `useColorModeValue`, ensure `initialColorMode` in `ChakraProvider` is driven from the same `getInitialThemeId()` result that `applyThemeToDocument` uses.

### Renderer API Access and Guard Style (2026-04-11)
- In renderer components/hooks, use `globalThis.window` (or `globalThis` APIs directly) instead of bare `window` references.
- Use optional chaining for capability checks and payload reads (`api?.method`, `result?.field`) instead of repetitive `&&` chains.
- For error fallback text, prefer `error?.message || 'fallback'` for concise, readable handling.

### Renderer Lint Baseline: Panel Components (2026-04-11)
- Add `propTypes` for every component in `src/renderer/js/components/**`, including child/table/viewer components, not only top-level panels.
- When props include structured data, define nested `PropTypes.shape(...)` contracts for accessed fields (for example `item.request`, `item.response`, `table.getRowModel`, `table.getFlatHeaders`, callback props like `onSelect`, `onSendToRepeater`, `onSendToIntruder`).
- Avoid nested ternary expressions in JSX and logic; compute an intermediate variable with `if/else` or a lookup map before rendering.
- Prefer optional chaining (`item?.request`, `table?.getRowModel?.()`) over `a && a.b` guard chains.
- Remove unused state setters and dead helpers immediately (`setPageSize`-style leftovers) to keep components warning-free.
- Keep component-internal nesting shallow; extract deeply nested callbacks/helpers to top-level utility functions when depth exceeds 4 levels.
- Keep pure helper functions (for example filter builders and match predicates) at module scope unless they rely on component-local closure state.
- 2026-04-12: When using native controls in JSX (`<select>`, `Box as='select'`, etc.), provide explicit accessible naming via `aria-label`, `aria-labelledby`, or `id`/`htmlFor` pairing; do not rely on nearby text only.
- 2026-04-12: Prefer shared select styling via the Chakra theme recipe (or a shared wrapper) instead of repeating `bg/color/border/px/h` props on each select instance.
- 2026-04-13: All interactive renderer controls must expose stable accessible names. For icon-only/symbol-only buttons (for example arrows, reload glyphs, close glyphs), always set explicit `aria-label` values (`Back`, `Forward`, `Reload`, `Stop`, etc.) so tests and assistive tech use deterministic naming independent of visual glyphs.
- 2026-04-13: Inputs and textareas must have programmatic names (`aria-label`, `aria-labelledby`, or `id`/`htmlFor`) even when placeholders are present. Placeholders are hint text only and are not an accessible-name substitute.
