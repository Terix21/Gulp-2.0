# Secure Code Instructions

## Scope
secure-code

## Conventions
- Treat main-process, preload, proxy, contracts, persistence, import, and build/versioning code as security-sensitive by default.
- Use `node:crypto` CSPRNG APIs (`randomUUID`, `randomBytes`) for identifiers, tokens, probe markers, and correlation values that cross process, file, or network boundaries.
- Prefer encrypted protocols (`https`, `wss`) for non-loopback URLs in source, fixtures, and generated payloads unless a documented exception applies.
- Keep user-influenced parsing deterministic: prefer bounded or linear-time parsing and avoid ambiguous or super-linear regex behavior.
- Validate and normalize untrusted inputs before persistence, network use, IPC transit, or filesystem access.

## Common Patterns
- Use `randomUUID()` for opaque IDs and `randomBytes(...).toString('hex')` for unpredictable marker/token material.
- Keep synthetic security test fixtures aligned with production expectations: use `https://example.test` for remote placeholders and reserve `http://127.0.0.1` / `http://localhost` for loopback-only cases.
- Prefer protocol/header parsing with explicit string scanning or multi-pass parsing over complex regex splits.
- Emit bounded diagnostics for recoverable security-adjacent failures rather than swallowing errors silently.

## Pitfalls
- Do not use `Math.random()` for values that could be guessed, replayed, correlated, or observed across trust boundaries.
- Do not introduce non-loopback clear-text URLs (`http://`, `ws://`) in scanner, proxy, update, import, or callback flows without a documented reason and threat review.
- Do not rely on regex patterns with nested or overlapping unbounded quantifiers on user-controlled input.
- Do not leave privileged behavior reachable from renderer code without a preload boundary.

## Append-Only Updates
- 2026-04-12: Scanner probe token generation must use `node:crypto`; `Math.random()` is not allowed for probe markers or correlation values in `src/main/**`.
- 2026-04-12: Non-loopback synthetic scanner SSRF marker URLs should use `https://` rather than `http://` to avoid insecure clear-text protocol usage in source and tests.
- 2026-04-12: Header and payload parsing in scanner/proxy paths must avoid ReDoS-prone regex complexity; prefer deterministic linear parsing.
- 2026-04-12: **Array Sorting Requirements** — Always provide a comparison function to `Array.prototype.sort()` and `.toSorted()`:
  - For **numbers**: use `(a, b) => a - b` (ascending) or `(a, b) => b - a` (descending).
  - For **strings**: use `(a, b) => a.localeCompare(b)` to ensure locale-aware, Unicode-compliant sorting.
  - For **objects**: provide explicit comparison logic based on sort key type (apply number or string rules accordingly).
  - **Rationale**: Default lexicographic sort converts all elements to strings, causing incorrect ordering (e.g., `[10, 2, 30].sort()` → `[10, 2, 30]` instead of `[2, 10, 30]`). Explicit comparators guarantee correctness and consistency across environments.
- 2026-04-12: **Dynamic Code Execution (S1522)** — SonarQube flags `eval()`, `Function()`, and `vm.runInNewContext()` as security-sensitive. Review and suppress as follows:
  - **REJECT** — Any dynamic code from user input, untrusted sources, or configuration files. Use static code or data-driven logic instead.
  - **SUPPRESS** — Legitimate test use cases with controlled, codebase-internal sources (e.g., testing preload.js in VM sandbox). Justify with `// NOSONAR S1522` comment explaining: (1) source is trusted/internal, (2) sandbox is isolated, (3) no untrusted input.
  - **NEVER** in production code paths. Eval and dynamic code are acceptable only in __tests__ or build-time scripts with full codebase control.
- 2026-04-12: **Hardcoded Temp Paths (S5445)** — SonarQube flags hardcoded `/tmp/`, `%TEMP%`, etc. as race conditions. Apply as follows:
  - **REJECT** — Hardcoded temp paths in production code that read, write, or create files. Use `os.tmpdir()` or secure temp file APIs.
  - **REPLACE IN TESTS** — Even in test fixtures, replace hardcoded paths with `path.join(os.tmpdir(), 'unique-fixture-name')` for consistency.
  - **BEST PRACTICE** — For actual temp files/dirs: use `fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-'))` to generate unpredictable names with secure permissions.
  - **Rationale**: Hardcoded temp paths enable race conditions where attackers predict filenames and manipulate content before the app creates/reads them. Using dynamic generation with process ID, timestamp, or random values prevents this.
- 2026-04-12: **Hardcoded IP Addresses (S1313)** — SonarQube flags hardcoded non-loopback IPs as security-sensitive. Guidelines:
  - **REJECT** — Hardcoded IPs in production code (proxy, scanner, network clients, etc.). Use environment variables, configuration, or DNS names instead.
  - **USE IN TESTS** — Loopback address `'127.0.0.1'` for test fixtures (explicitly exception-listed; safe and semantically appropriate for tests).
  - **ACCEPTABLE EXCEPTIONS** — Documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32) rarely appear in tests; loopback is preferred.
  - **Rationale**: Hardcoded addresses leak network topology, enable targeted denial-of-service attacks, and block operational flexibility for scaling and multi-environment deployments.
- 2026-04-12: **Deep Cloning (S7784)** — Use `structuredClone()` instead of `JSON.parse(JSON.stringify())`:
  - **ALWAYS USE** — `structuredClone(value)` for deep cloning in Node.js 17+ and modern browsers.
  - **NEVER USE** — `JSON.parse(JSON.stringify())` pattern. Limitations: cannot handle functions, undefined, symbols, Date objects, RegExp, Maps, Sets, or circular references. Silent data corruption risk.
  - **WHY CHANGE** — structuredClone() is faster, handles edge cases, requires no dependencies, and is TC39 standard.
  - All 11 proxy service clone() functions updated per this requirement (decoder, embedded-browser, intruder, oob, repeater, history, rules, intercept, sequencer, target-mapper, extension-host).
- 2026-04-12: **String Replacement (S5361/S6551-style guidance)** — Prefer `String#replaceAll()` over `String#replace()` when replacing all matches:
  - **PREFER** — `replaceAll('token', 'value')` for literal multi-occurrence replacements.
  - **PREFER** — `replaceAll(/pattern/g, 'value')` over `replace(/pattern/g, 'value')` where semantics are identical.
  - **KEEP `replace()`** — for single replacement semantics or callback-driven transforms where `replaceAll()` is not clearer.
  - Decoder HTML encode/decode and normalization paths were updated accordingly.
- 2026-04-12: **Type-Specific Validation Errors** — For argument/type contract checks in `src/main/**`, throw `TypeError` instead of generic `Error` when the failure is due to an invalid value type or shape.
- 2026-04-12: **Deterministic Import Parsing** — Burp XML/JSON scope import parsing must remain deterministic and helper-driven: normalize regex-like host/path/port fields via dedicated helpers, reject hostless entries with explicit warnings, and avoid deeply nested parser branches that can cause inconsistent in-scope/out-of-scope decisions.
- 2026-04-12: **Regex Construction Safety/Clarity** — When building regex patterns from escaped string fragments in new or modified security-sensitive parsing code, prefer `String.raw` pattern templates and `RegExp.exec()` extraction flow for clearer escaping and predictable behavior.
- 2026-04-12: **GitHub Actions Supply Chain Pinning (CWE-494, CWE-829)** — Every `uses:` reference in `.github/workflows/` must be pinned to an immutable commit SHA, not a mutable tag (e.g. `v4`, `v5`). Resolve the SHA with `git ls-remote <repo-url> refs/tags/<tag>` before adding or updating any action. Mutable tags can be silently redirected by a compromised upstream, executing arbitrary code in CI.
- 2026-04-12: **VM Execution Hardening (CWE-95)** — The `vm.Script` sandbox in `extension-host.js` is in-process only. All three controls must be active: (1) trusted package root path check before loading extension code, (2) per-extension sliding-window event rate limiting to prevent runaway handler loops, (3) security audit entries before and after every `runInContext()` call. The `trustedPackageRoots` setting defaults to permissive (empty); production `extensionHost.configure()` must supply an explicit root list.
- 2026-04-12: **Permission Self-Approval Prevention** — IPC install/activation flows must never accept renderer-supplied `approvedPermissions`. The renderer may declare required permissions; the approval decision must be made in the main process against a static server-side allowlist. Allowing the same caller to both request and approve permissions is an elevation-of-privilege pattern and is an identified open gap in the current `extensions:install` IPC handler.