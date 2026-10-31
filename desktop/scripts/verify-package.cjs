const fs = require('node:fs');
const path = require('node:path');
module.exports = async context => {
  const root = path.join(context.appOutDir, 'resources');
  for (const name of [
    'app.asar', 'server/server.js', 'server/node_modules/next/package.json',
    'server/node_modules/react/package.json', 'server/.next/BUILD_ID',
    'server/.next/static', 'server/public/favicon.ico',
    'licenses/LibreTV-AGPL-3.0.txt', 'licenses/ArtPlayer-MIT.txt', 'LibreTV-Desktop-source.zip',
  ]) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`Packaged resource missing: ${name}`);
  }
  for (const name of fs.readdirSync(path.join(root, 'server'))) {
    if (name.startsWith('.env')) throw new Error('Machine credentials must not be packaged');
  }
  console.log('Packaged standalone closure and source/license checks: PASS');
};
