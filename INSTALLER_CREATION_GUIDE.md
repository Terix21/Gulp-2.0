# Installer Creation Guide (Windows)

This guide shows how to create a Windows installer for this Electron app.

## 1. Install packaging tools

Run in the project root:

```powershell
npm install --save-dev electron-builder
```

## 2. Add packaging scripts to package.json

Add these scripts under `scripts`:

```json
{
  "scripts": {
    "pack:win": "npm run build && electron-builder --win --dir",
    "installer:win": "npm run build && electron-builder --win nsis"
  }
}
```

- `pack:win` creates an unpacked app folder (good for quick smoke checks).
- `installer:win` creates an NSIS installer `.exe`.

## 3. Add electron-builder configuration

Add a `build` section to `package.json`:

```json
{
  "build": {
    "appId": "com.trogon4081.gulp",
    "productName": "Sentinel",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraMetadata": {
      "main": "dist/main/index.js"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

## 4. Build app artifacts first

Your runtime entry is `dist/main/index.js`, so always build before packaging:

```powershell
npm run build
```

## 5. Generate installer

```powershell
npm run installer:win
```

Expected output location:

- `release/` (installer executable and packaging artifacts)

## 6. Verify installer output

1. Run the generated installer `.exe`.
2. Launch the installed app.
3. Confirm startup works (no blank window).
4. Confirm core workflows load (Proxy, History, Repeater).

## 7. Optional: code signing (recommended)

Unsigned installers trigger SmartScreen warnings. For production distribution:

1. Obtain a code-signing certificate.
2. Set signing variables in your CI/local environment.
3. Configure `electron-builder` signing options for Windows.

## 8. Optional: add icons and metadata

- Add app icon path in `build.win.icon`.
- Add publisher/contact metadata as needed for release channels.

## 9. CI automation (optional)

Use a CI job that runs:

```powershell
npm ci
npm run build
npm run installer:win
```

Then publish artifacts from `release/`.

## Troubleshooting

- Error: main entry missing
  - Ensure `npm run build` completed and `dist/main/index.js` exists.

- Native module errors (for example `sqlite3`)
  - Rebuild dependencies against Electron version and retry packaging.

- Installer starts but app fails
  - Confirm `build.files` includes `dist/**/*` and runtime dependencies.
