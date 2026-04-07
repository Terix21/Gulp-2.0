# Test Coverage Strategy

## Overview
This project enforces **80%+ code coverage** on implementation modules. Coverage is measured on the Vitest platform with v8 provider.

## Coverage Breakdown

### Achieving 80%+
- **src/renderer/js/theme.js**: ✅ 100% (all lines, branches, functions)
  - Complete Chakra UI theme configuration with explicit color tokens
  - Testable due to pure function/data structure nature

### Excluded Modules
No Sentinel module placeholders remain through M9. Extension host and script runtime behavior now have dedicated functional tests, and the workbench shell has renderer regression coverage.

### Partial Coverage (Integration-Heavy)
- `src/main/preload.js`: 100% branch/function, 0% statements
  - *(contextBridge exposure is patternized; unit tests validate structure)*
- `src/renderer/js/main.jsx` & `src/main/index.js`: Not measured
  - *(Electron/React bootstrap code requires integration tests)*

## Test Metrics
- **Test Files**: 26 suites total (including SEN-018 through SEN-024 suites and renderer workbench regressions)
- **Current full-suite status**: 2 known unrelated embedded-browser failures are currently tracked:
  - `src/main/proxy/__tests__/sen20-embedded-browser.test.js` (host-model expectation mismatch)
  - `src/renderer/js/components/sentinel/__tests__/components.test.js` (expects `Reload` text while compact control currently renders icon-label variant)
- **Post-build smoke**: 3/3 via `npm run test:build`
- **Recent additions (SEN-020 Chromium-first refactor)**: 5 pure-unit tests for embedded browser service covering Chromium-first pending response shape, history state machine (back/forward/reload with completeRuntimeNavigation simulation), URL normalization, session state controls, and runtime state apply; 1 renderer integration test covering full browser session lifecycle (listSessions → focusSession → showView → setBounds → navigate → reload)
- **Recent additions (proxy runtime settings)**: forwarding tests now validate configured custom header injection, tool-identifier header injection, and static source-IP (`localAddress`) application.
- **Recent additions**: SEN-017 Intruder coverage (11 tests) covering real HTTP attacks, dictionary/brute-force/sequential payload generation, sniper/pitchfork/cluster-bomb profiles, progress events, anomaly detection, graceful stop, and panel interaction flows
- **Recent additions**: M9 renderer coverage validating the fixed-viewport shell, dark-first theme tokens, context-rail quick-action behavior, and expandable/collapsible module activity rail assumptions
- **Average (measured files)**: >80%

## Running Tests

```bash
npm test                # Watch mode
npm test -- --run       # Single run
npm run test:ui         # Vitest UI dashboard
npm run test:coverage   # Coverage report
```

## Future Coverage Targets
1. Add full Electron integration coverage for live IPC event delivery from `src/main/index.js` into renderer panels.
2. Expand extension/runtime coverage from unit-level behavior to renderer-main integration event flow assertions.
3. Post-MVP: Full feature parity → 90%+ target (with integration tests)

---
**Policy**: Coverage thresholds enforced in CI/CD; failing builds block merge.
