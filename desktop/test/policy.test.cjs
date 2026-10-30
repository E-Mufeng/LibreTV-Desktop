const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isInternalUrl, externalUrl, readConfig, readSourcePresets } = require('../policy.cjs');
test('navigation permits exactly the embedded origin', () => {
  const origin = 'http://127.0.0.1:28921';
  assert.equal(isInternalUrl(origin + '/watch?id=1', origin), true);
  for (const url of ['https://example.com', 'http://127.0.0.1:8080', 'http://127.0.0.1.evil.test:28921', 'file:///C:/x', 'javascript:alert(1)']) assert.equal(isInternalUrl(url, origin), false);
});
test('source presets reuse the portable source-list format and reject invalid data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'libretv-sources-'));
  try {
    assert.deepEqual(readSourcePresets(directory), []);
    const file = path.join(directory, 'sources.json');
    const source = { name: '公开源', url: 'https://example.com/api', isAdult: false };
    fs.writeFileSync(file, JSON.stringify({ name: 'LibreTV-SourceList', sources: [source] }));
    assert.deepEqual(readSourcePresets(directory), [source]);
    for (const bad of [null, {}, { name: '', url: 'https://x.test' }, { name: 'x', url: 'file:///C:/x' }, { name: 'x', url: 'https://user:secret@x.test' }, { ...source, detail: 'javascript:x' }]) {
      fs.writeFileSync(file, JSON.stringify([bad]));
      assert.throws(() => readSourcePresets(directory));
    }
    fs.writeFileSync(file, 'not json'); assert.throws(() => readSourcePresets(directory));
    fs.writeFileSync(file, JSON.stringify(Array(51).fill(source))); assert.throws(() => readSourcePresets(directory));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('OS external links exclude executable protocols and embedded credentials', () => {
  assert.equal(externalUrl('https://example.com/'), 'https://example.com/');
  for (const url of ['file:///C:/x', 'javascript:alert(1)', 'shell:startup', 'https://user:password@example.com', 'bad']) assert.equal(externalUrl(url), null);
});
test('portable configuration persists independently generated signing secrets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'libretv-config-'));
  try {
    const a = readConfig(directory), b = readConfig(directory);
    assert.equal(a.password, '123'); assert.equal(a.port, 28921);
    assert.equal(a.proxySecret.length, 64); assert.deepEqual(a, b);
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ ...a, port: 80 }));
    assert.throws(() => readConfig(directory), /port/);
    fs.writeFileSync(path.join(directory, 'config.json'), '{broken');
    assert.throws(() => readConfig(directory));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
