# LibreTV Desktop build / source

This is an AGPL-3.0-or-later desktop integration based on LibreSpark/LibreTV v2.21.1.
It is not an official LibreSpark desktop release. All changes and build scripts are included.

## Requirements
Windows x64, Node.js 24, npm, Windows PowerShell 5.1 or PowerShell 7.

## Build
From the LibreTV repository root in PowerShell:

```powershell
npm ci
$env:NEXT_TELEMETRY_DISABLED='1'
$env:DOCKER_BUILD='1'
npm run build -- --webpack
Remove-Item Env:DOCKER_BUILD
Set-Location desktop
npm ci
# If npm's install-script policy skipped Electron's download:
node node_modules/electron/install.js
npm test
npm run pack
```

The single portable EXE appears in desktop/release. It contains Electron, the standalone
Next.js server, static assets, licenses and a matching complete source archive.
The runtime does not require a separately installed Node.js or the original repository.
Temporary extraction is expected for a Windows portable EXE.

## Data and access
LibreTV-data beside the portable executable contains config.json, Chromium profile and logs.
Default password is 123; proxy signing uses a separately generated random secret.
The internal server listens only on 127.0.0.1:28921. The configured port is stable so
IndexedDB/history retain their browser origin across restarts. A conflicting port is a
visible startup error, not an automatic switch to a different data origin.
Only one instance runs for a given data directory. Closing the window terminates the
internal service. No system service, startup task, telemetry or video sources are added.

## Distribution status
This artifact is unsigned: no publisher certificate was supplied. Signing, brand ownership,
content-source agreements and distribution-specific acceptance remain release-owner tasks.
Commercial redistribution does not remove AGPL source and notice obligations; see LICENSE.
The source archive is accessible from the application's Help menu.

## Dependency changes
This integration upgrades Next.js to 16.4.3 and test tooling to Vitest 5.0.5 / Vite 8.3.5
to address advisories in the upstream lock file. ESLint keeps the upstream 15.5.25
configuration/rule baseline; the app does not enable the React Compiler.
Re-run audits and tests before each release. Sources do not contain local credentials.
