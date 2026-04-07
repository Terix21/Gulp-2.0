# Gulp Instructions

## Scope
gulp

## Version
^5.0.1

## Conventions
- **Task-based:** Organize build steps into individual tasks.
- **Piping:** Use `.pipe()` to chain multiple operations together.
- **`gulpfile.js`:** Define all tasks in a `gulpfile.js` at the project root.

## Common Patterns
- **`gulp.series()`:** Run tasks in sequence.
- **`gulp.parallel()`:** Run tasks concurrently.
- **`gulp.watch()`:** Watch files for changes and run tasks automatically.

## Pitfalls
- **Callback Hell:** Avoid deeply nested callbacks by using `async/await` or returning streams.
- **Error Handling:** Use `plumber` or other error handling plugins to prevent crashes on errors.

## Append-Only Updates
- 2026-04-02: When introducing workbench UI tooling (`@tanstack/react-table`, `@tanstack/react-virtual`/`react-window`, `@monaco-editor/react`), validate renderer bundling compatibility with current esbuild setup before merging.
- 2026-04-02: Keep new renderer dependencies in `dependencies` when required at runtime, and ensure watch/build continues to emit runnable `dist/renderer/js/app.js` without manual dist edits.
