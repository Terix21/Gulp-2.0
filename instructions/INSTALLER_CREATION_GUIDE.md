# Installer Creation Guide (Windows)

This guide shows the current packaging flow for creating a Windows installer for this Electron app.

## Current project status
Packaging is already configured in this repository:
- `electron-builder` is already present in `devDependencies`.
- `pack:win` and `installer:win` scripts are already defined in `package.json`.
- Electron Builder `build` config (NSIS target, output directory, packaged files) is already defined in `package.json`.

You do not need to add new packaging scripts/config unless you are intentionally changing release behavior.

## 1. Install dependencies

Run in the project root:

```powershell
npm install
```

## 2. Build app artifacts first

Your runtime entry is `dist/main/index.js`, so always build before packaging:

```powershell
npm run build
```

## 3. Optional smoke package (unpacked)

Generate an unpacked Windows app folder for fast validation:

```powershell
npm run pack:win
```

## 4. Generate installer

```powershell
npm run installer:win
```

Expected output location:

- `release/` (installer executable and packaging artifacts)

## 5. Verify installer output

1. Run the generated installer `.exe`.
2. Launch the installed app.
3. Confirm startup works (no blank window).
4. Confirm core workflows load (Proxy, History, Repeater).

## 6. Optional: code signing (recommended)

Unsigned installers trigger SmartScreen warnings. For production distribution:

1. Obtain a code-signing certificate.
2. Set signing variables in your CI/local environment.
3. Configure `electron-builder` signing options for Windows.

## 7. Optional: add icons and metadata

- Add app icon path in `build.win.icon`.
- Add publisher/contact metadata as needed for release channels.

## 8. CI automation (optional)

Use a CI job that runs:

```powershell
npm ci --ignore-scripts
npm run rebuild:native
npm run build
npm run installer:win
```

Then publish artifacts from `release/`.

## Troubleshooting

- Error: main entry missing
  - Ensure `npm run build` completed and `dist/main/index.js` exists.

- Native module errors (for example `sqlite3`)
  - Run `npm run rebuild:native`, then retry `npm run installer:win`.

- Installer starts but app fails
  - Confirm `build.files` includes `dist/**/*` and runtime dependencies.

- CI install skipped postinstall scripts
  - If native module ABI mismatches occur after `npm ci --ignore-scripts`, run `npm run rebuild:native` before packaging.
