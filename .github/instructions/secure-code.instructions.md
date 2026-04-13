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