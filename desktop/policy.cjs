'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function isInternalUrl(value, origin) {
  try { return new URL(value).origin === origin; } catch { return false; }
}
function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function readConfig(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'config.json');
  if (!fs.existsSync(file)) {
    const config = { password: '123', port: 28921, proxySecret: crypto.randomBytes(32).toString('hex') };
    fs.writeFileSync(file, JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof config.password !== 'string' || !config.password) throw new Error('config.json 中的 password 不能为空');
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error('config.json 中的 port 应为 1024–65535');
  if (typeof config.proxySecret !== 'string' || config.proxySecret.length < 32) throw new Error('config.json 中的 proxySecret 至少需要 32 个字符');
  return config;
}
function readSourcePresets(directory) {
  const file = path.join(directory, 'sources.json');
  if (!fs.existsSync(file)) return [];
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sources = Array.isArray(payload) ? payload : payload?.sources;
  if (!Array.isArray(sources) || sources.length > 50) throw new Error('sources.json 应包含最多50个点播源');
  return sources.map((item) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.url !== 'string' || !externalUrl(item.url)) throw new Error('sources.json 含无效的源名称或HTTP(S)地址');
    const source = { name: item.name.trim(), url: item.url.trim(), isAdult: item.isAdult === true };
    if (item.detail !== undefined) {
      if (typeof item.detail !== 'string' || !externalUrl(item.detail)) throw new Error('sources.json 含无效的详情地址');
      source.detail = item.detail;
    }
    return source;
  });
}
module.exports = { isInternalUrl, externalUrl, readConfig, readSourcePresets };
