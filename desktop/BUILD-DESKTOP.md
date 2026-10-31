# LibreTV Desktop build / source

This is an AGPL-3.0-or-later desktop integration based on LibreSpark/LibreTV v2.21.1.
It is not an official LibreSpark desktop release. All changes and build scripts are included.

Desktop 1.2.0 adds an explicit personal-library workflow (watchlist, liked, watched,
continue watching), discover navigation and a keyboard-shortcut guide. Local
JSON/Bilibili XML danmaku uses the MIT ArtPlayer plugin; no public comment service
or online posting endpoint is configured. Source presets are unchanged from 1.1.0.

Desktop 1.3.0 restores the unobtrusive clock-drawer/more-menu entries and removes
the personal dashboard from the home page, keeping its data and features. It adds
the fixed Internet Archive movie/animation search + metadata adapter and native
MP4 playback (including existing authenticated Range proxy and resume logic).
Only tested public media providers are appended to the portable data presets;
existing source ordering/keys, original profile and history schema stay unchanged.

Desktop 1.3.1 fixes the generic media proxy's total-body 8-second abort. Header
waiting remains bounded, progressing bodies use a 30-second read-idle timeout,
client cancellation aborts upstream, and buffered rewritten playlists have a
4 MiB limit. Signed `.m3u8?query` URLs are recognized even with octet-stream MIME.
No sources, credentials, ports, dependencies or user-data schemas are changed.

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

The original `libretv` IndexedDB schema stays at v3. Additive personal flags and
imported per-episode danmaku use `libretv-personal` v1 in the SAME Chromium profile.
This is not an empty replacement history database. Older releases can still read
their original history/settings on rollback; the new personal flags remain stored
but are only displayed by 1.2+. Personal flags join the existing settings export;
local danmaku files are retained separately (keep the original imported files).

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
