# Vite Instructions

## Scope
vite

## Version
^7.1.10

## Conventions
- Keep build behavior centralized in `vite.config.js`.
- Keep renderer root at `src/renderer` with output under `dist/renderer`.
- Keep Electron main/preload entries explicit and output to `dist/main`.

## Common Patterns
- Use `npm run build` for production output and `npm run dev` for iteration.
- Use `vite-plugin-static-copy` for docs/contracts copied into `dist`.
- Keep renderer imports browser-safe and route privileged access through preload.

## Pitfalls
- Do not hand-edit `dist/` artifacts.
- Do not break static-copy targets when moving documentation files.
- Do not assume `npm run start` rebuilds artifacts; build first.

## Append-Only Updates
- 2026-04-07: Adopted as primary build system after Gulp removal.
