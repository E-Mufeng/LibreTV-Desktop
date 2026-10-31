'use strict';
const { app, BrowserWindow, Menu, dialog, shell, utilityProcess, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { isInternalUrl, externalUrl, readConfig, readSourcePresets } = require('./policy.cjs');

const home = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath))
  : path.resolve(__dirname, '..');
const dataDir = path.join(home, 'LibreTV-data');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, 'profile'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'downloads'), { recursive: true });
app.setPath('userData', path.join(dataDir, 'profile'));
app.setPath('sessionData', path.join(dataDir, 'profile'));
app.setPath('downloads', path.join(dataDir, 'downloads'));
app.setPath('logs', path.join(dataDir, 'logs'));
fs.mkdirSync(app.getPath('logs'), { recursive: true });
const logFile = path.join(app.getPath('logs'), 'desktop.log');
const log = value => fs.appendFileSync(logFile, `${new Date().toISOString()} ${String(value)}\n`);
let win;
let server;
let quitting = false;
let errorReported = false;
let origin;
let config;
const resource = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'staged');

function stopServer() {
  if (server) { try { server.kill(); } catch (error) { log(error.message); } server = null; }
}
function report(error) {
  if (errorReported || quitting) return;
  errorReported = true;
  log(error.stack || error);
  dialog.showErrorBox('LibreTV 启动失败', `${error.message}\n\n日志：${logFile}\n请检查数据目录中的 config.json 或端口占用。`);
  app.quit();
}
function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => reject(new Error(`本机端口 ${port} 被占用或不可用：${error.code}`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
async function waitForServer() {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    if (!server || !server.pid) throw new Error('内置服务提前退出');
    try {
      const response = await fetch(`${origin}/api/status`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const status = await response.json();
        if (status.passwordRequired && status.version) return status;
      }
    } catch { /* Startup readiness: do not hide an error once the deadline expires. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('内置服务 60 秒内未就绪');
}
function setupMenu() {
  const helpFile = name => path.join(resource, name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [
      { label: '打开数据目录', click: () => shell.openPath(dataDir) },
      { label: '查看运行日志', click: () => shell.showItemInFolder(logFile) },
      { type: 'separator' }, { role: 'quit', label: '退出' },
    ] },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'reload', label: '刷新' }, { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }] },
    { label: '导航', submenu: [
      { label: '发现影片', accelerator: 'CommandOrControl+1', click: () => win.loadURL(origin) },
      { label: '我的片库', accelerator: 'CommandOrControl+2', click: () => win.loadURL(`${origin}/library`) },
      { label: '收藏待看', click: () => win.loadURL(`${origin}/library?tab=saved`) },
      { label: '我的喜欢', click: () => win.loadURL(`${origin}/library?tab=liked`) },
      { label: '观看记录', click: () => win.loadURL(`${origin}/library?tab=history`) },
    ] },
    { label: '帮助', submenu: [
      { label: '开源许可', click: () => shell.openPath(helpFile('licenses/LibreTV-AGPL-3.0.txt')) },
      { label: '本版本完整源代码', click: () => shell.showItemInFolder(helpFile('LibreTV-Desktop-source.zip')) },
      { label: '关于 LibreTV Desktop', click: () => dialog.showMessageBox(win, {
        type: 'info', title: 'LibreTV Desktop', message: `LibreTV Desktop ${app.getVersion()}`,
        detail: '基于 LibreSpark/LibreTV v2.21.1，增加分类选片、个人片库、本地弹幕与公开视频源的桌面整合版。\nAGPL-3.0-or-later；许可证及完整源代码随程序附带。\n第三方源保存在本机数据目录，不代表 LibreSpark 官方客户端。\n\n数据目录：' + dataDir,
      }) },
    ] },
  ]));
}
async function launch() {
  config = readConfig(dataDir);
  origin = `http://127.0.0.1:${config.port}`;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(permission === 'fullscreen' && isInternalUrl(contents.getURL(), origin));
  });
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 940, minHeight: 640, show: false,
    backgroundColor: '#0b111c', title: 'LibreTV Desktop', icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    const allowed = externalUrl(url);
    if (allowed) void shell.openExternal(allowed);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url, origin)) {
      event.preventDefault();
      const allowed = externalUrl(url);
      if (allowed) void shell.openExternal(allowed);
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer exited: ${details.reason}`);
    if (!quitting && details.reason !== 'clean-exit') report(new Error('界面进程异常退出，请重新启动程序'));
  });
  setupMenu();
  await win.loadFile(path.join(__dirname, 'assets/loading.html'));
  await assertPortAvailable(config.port);
  const serverDir = path.join(resource, 'server');
  const entry = path.join(serverDir, 'server.js');
  if (!fs.existsSync(entry)) throw new Error('缺少打包后的内置服务 server.js');
  const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(config.port), PASSWORD: config.password, PROXY_SECRET: config.proxySecret, DEFAULT_SOURCES: JSON.stringify(readSourcePresets(dataDir)), NEXT_TELEMETRY_DISABLED: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  server = utilityProcess.fork(entry, [], { cwd: serverDir, env, stdio: 'pipe', serviceName: 'LibreTV Local Service' });
  server.stdout.on('data', data => log(data.toString()));
  server.stderr.on('data', data => log(data.toString()));
  server.on('exit', code => {
    server = null;
    log(`Server exited: ${code}`);
    if (!quitting) report(new Error(`内置服务停止（${code}）`));
  });
  await new Promise((resolve, reject) => {
    server.once('spawn', resolve);
    server.once('exit', code => reject(new Error(`内置服务启动时退出（${code}）`)));
  });
  const status = await waitForServer();
  log(`READY ${origin} LibreTV ${status.version}`);
  fs.writeFileSync(path.join(dataDir, 'runtime.json'), JSON.stringify({ pid: process.pid, serverPid: server.pid, url: origin, version: app.getVersion() }, null, 2));
  await win.loadURL(origin);
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.on('before-quit', () => { quitting = true; stopServer(); });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(launch).catch(report);
}
