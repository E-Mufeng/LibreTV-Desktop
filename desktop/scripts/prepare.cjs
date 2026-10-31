'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const desktop = path.resolve(__dirname, '..');
const root = path.dirname(desktop);
const stage = path.join(desktop, 'staged');
if (path.dirname(stage) !== desktop || path.basename(stage) !== 'staged') throw new Error('Unexpected staging path');
if (!fs.existsSync(path.join(root, '.next/standalone/server.js'))) throw new Error('Run DOCKER_BUILD=1 npm run build before packaging.');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
const server = path.join(stage, 'server');
fs.cpSync(path.join(root, '.next/standalone'), server, {
  recursive: true,
  filter: source => !path.basename(source).startsWith('.env'),
});
fs.cpSync(path.join(root, '.next/static'), path.join(server, '.next/static'), { recursive: true });
fs.cpSync(path.join(root, 'public'), path.join(server, 'public'), { recursive: true });
const licenses = path.join(stage, 'licenses');
fs.mkdirSync(licenses, { recursive: true });
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(licenses, 'LibreTV-AGPL-3.0.txt'));
const notices = ['LibreTV Desktop: AGPL-3.0-or-later', 'Based on LibreSpark/LibreTV v2.21.1', 'Corresponding source: ../LibreTV-Desktop-source.zip', ''];
function copyPackageLicenses(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || item.isSymbolicLink()) continue;
    const folder = path.join(directory, item.name);
    if (item.name.startsWith('@')) { copyPackageLicenses(folder); continue; }
    const pkgFile = path.join(folder, 'package.json');
    if (!fs.existsSync(pkgFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    notices.push(`${pkg.name}@${pkg.version}: ${JSON.stringify(pkg.license || 'See package license')}`);
    const destination = path.join(licenses, pkg.name.replaceAll('/', '__') + '-' + pkg.version);
    for (const file of fs.readdirSync(folder)) {
      if (/^(license|licence|copying|notice)(\.|$)/i.test(file) && fs.statSync(path.join(folder, file)).isFile()) {
        fs.mkdirSync(destination, { recursive: true });
        fs.copyFileSync(path.join(folder, file), path.join(destination, file));
      }
    }
    if (fs.existsSync(path.join(folder, 'node_modules'))) copyPackageLicenses(path.join(folder, 'node_modules'));
  }
}
copyPackageLicenses(path.join(server, 'node_modules'));
// Client-only packages are bundled by webpack and absent from standalone traces.
// Include their notices as well, rather than silently dropping browser licenses.
const productionDependencies = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies;
for (const name of Object.keys(productionDependencies)) {
  const folder = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
  const notice = `${pkg.name}@${pkg.version}: ${JSON.stringify(pkg.license || 'See package license')}`;
  if (!notices.includes(notice)) notices.push(notice);
  for (const file of fs.readdirSync(folder)) {
    if (/^(license|licence|copying|notice)(\.|$)/i.test(file) && fs.statSync(path.join(folder, file)).isFile()) {
      const destination = path.join(licenses, pkg.name.replaceAll('/', '__') + '-' + pkg.version);
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(path.join(folder, file), path.join(destination, file));
    }
  }
}
fs.copyFileSync(path.join(desktop, 'assets/licenses/ArtPlayer-MIT.txt'), path.join(licenses, 'ArtPlayer-MIT.txt'));
fs.writeFileSync(path.join(licenses, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
const sources = path.join(stage, 'sources', 'LibreTV');
fs.mkdirSync(sources, { recursive: true });
for (const name of ['src', 'public', '.env.example', 'package.json', 'package-lock.json', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts', 'vitest.config.ts', 'eslint.config.mjs', 'README.md', 'LICENSE']) {
  if (fs.existsSync(path.join(root, name))) fs.cpSync(path.join(root, name), path.join(sources, name), { recursive: true });
}
const desktopSource = path.join(sources, 'desktop');
fs.mkdirSync(desktopSource, { recursive: true });
for (const name of ['main.cjs', 'policy.cjs', 'package.json', 'package-lock.json', 'assets', 'scripts', 'test', 'BUILD-DESKTOP.md']) {
  fs.cpSync(path.join(desktop, name), path.join(desktopSource, name), { recursive: true });
}
const zip = path.join(stage, 'LibreTV-Desktop-source.zip');
const escaped = value => value.replaceAll("'", "''");
const result = spawnSync(process.env.PWSH || 'powershell.exe', ['-NoProfile', '-Command', `$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath '${escaped(sources)}' -DestinationPath '${escaped(zip)}' -Force`], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error(`Source archive failed: ${result.stderr || result.stdout}`);
console.log(JSON.stringify({ server, sourceArchive: zip, productionPackageNotices: notices.length - 4 }));
