'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer } = require('ws');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');

// Disable GPU acceleration: avoids blank / black windows on many Linux setups
// (VMs, older drivers, Wayland quirks) and keeps rendering rock-solid.
app.disableHardwareAcceleration();

const APP_BRIDGE_VERSION = '1.1.0';
const DEFAULT_CONFIG = {
  origin: 'http://localhost:9002',
  port: 9080,
  companyId: '',
  labelPrinter: '',
  receiptPrinter: '',
};

let mainWindow = null;
let tray = null;
let wss = null;
let httpServer = null;
let isQuitting = false;

let config = { ...DEFAULT_CONFIG };
let scanBuffer = '';
let captureActive = false;
const scanLedger = [];
const serviceMode = os.platform() === 'win32' ? 'taskbar (tray)' : 'tray/panel';
let gotQuit = false;

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8');
    config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
}

function saveConfig(partial) {
  config = { ...config, ...partial };
  try {
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return config;
}

// ---------------- Local WebSocket + HTTP server ----------------

function broadcast(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch {
        // ignore
      }
    }
  }
}

function startServer() {
  const port = Number(config.port) || 9080;

  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        app: 'ecbills-scanner-bridge',
        version: APP_BRIDGE_VERSION,
        port,
        captureMode: captureActive ? 'window' : 'none',
        clients: wss ? wss.clients.size : 0,
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ecbills scanner bridge');
  });

  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    try {
      ws.send(JSON.stringify({
        type: 'hello',
        app: 'ecbills-scanner-bridge',
        version: APP_BRIDGE_VERSION,
        port,
        captureMode: captureActive ? 'window' : 'idle',
      }));
    } catch {
      // ignore
    }
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(String(data));
        if (message && message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore
      }
    });
  });

  httpServer.on('error', (err) => {
    console.error(`[bridge] Failed to bind 127.0.0.1:${port}`, err.message);
  });

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`[bridge] Scanner bridge listening on ws://127.0.0.1:${port}`);
    sendStatus();
  });
}

// ---------------- Scan capture (USB keyboard-wedge scanners) ----------------

function emitScan(code) {
  if (!code) return;
  const entry = { code, at: Date.now() };
  scanLedger.unshift(entry);
  if (scanLedger.length > 100) scanLedger.length = 100;
  broadcast({ type: 'scan', code });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan', entry);
  }
}

function handleCaptureKey(key) {
  if (key === 'Enter' || key === 'NumpadEnter') {
    if (scanBuffer.trim()) {
      const code = scanBuffer.trim();
      scanBuffer = '';
      emitScan(code);
    }
    return true;
  }
  if (key === 'Escape' || key === 'Tab') {
    scanBuffer = '';
    return true;
  }
  if (key === 'Backspace') {
    scanBuffer = scanBuffer.slice(0, -1);
    return true;
  }
  if (key && key.length === 1) {
    scanBuffer += key;
    return true;
  }
  return false;
}

// ---------------- Products API (main-process fetch: no CORS) ----------------

async function api(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const result = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      result,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function addProduct(productData, companyId) {
  if (!config.origin || !companyId) {
    return { success: false, message: 'Configure the web app origin and Company ID first.' };
  }
  const { ok, status, result } = await api(`${config.origin}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productData, companyId }),
  });
  if (!ok) {
    return { success: false, message: (result && result.message) || `Web app returned HTTP ${status}.` };
  }
  return { success: true, data: result && result.data };
}

async function listProducts(companyId) {
  if (!config.origin || !companyId) return { success: false, message: 'Configure origin + Company ID.' };
  const { ok, status, result } = await api(`${config.origin}/api/products?companyId=${encodeURIComponent(companyId)}`);
  if (!ok) return { success: false, message: (result && result.message) || `Web app returned HTTP ${status}.` };
  return { success: true, data: (result && result.data) || [] };
}

async function setProductSku(productId, companyId, sku) {
  if (!config.origin || !companyId || !productId) return { success: false, message: 'Missing product/company.' };
  const { ok, status, result } = await api(`${config.origin}/api/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productData: { sku }, companyId }),
  });
  if (!ok) return { success: false, message: (result && result.message) || `Web app returned HTTP ${status}.` };
  return { success: true, data: result && result.data };
}

async function checkOrigin(origin) {
  try {
    const { ok, status } = await api(origin, { method: 'GET' }, 8000);
    return { success: ok, status };
  } catch (err) {
    return { success: false, status: 0, message: String(err && err.message || err) };
  }
}

// ---------------- Barcode / QR generation ----------------

async function makeBarcodeDataUrl(text, type) {
  if (type === 'qr' || type === 'qrcode') {
    const dataUrl = await QRCode.toDataURL(text, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
    return { success: true, dataUrl };
  }
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 16,
    includetext: true,
    textxalign: 'center',
    backgroundcolor: 'ffffff',
  });
  return { success: true, dataUrl: `data:image/png;base64,${png.toString('base64')}` };
}

// ---------------- Label printing ----------------

function printLabelHtml(labels, columns) {
  const col = columns || 3;
  const escape = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cards = labels.map((l) => `
    <div class="label">
      ${l.qr ? `<img class="qr" src="${l.qr}" alt="QR" />` : ''}
      <div class="name">${escape(l.name)}</div>
      ${l.price ? `<div class="price">&#8377;${Number(l.price).toFixed(2)}</div>` : ''}
      ${l.barcode ? `<img class="barcode" src="${l.barcode}" alt="${escape(l.code)}" />` : ''}
      <div class="code">${escape(l.code)}</div>
    </div>`).join('');

  return `<html><head><title>Barcode Labels</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 10px; background: #fff; }
    @page { size: auto; margin: 8mm; }
    .sheet { display: grid; grid-template-columns: repeat(${col}, 1fr); gap: 6mm; }
    .label { border: 1px solid #d1d5db; border-radius: 4px; padding: 6mm 4mm; text-align: center; break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2mm; }
    .name { font-size: 11pt; font-weight: 600; color: #111827; line-height: 1.15; }
    .price { font-size: 12pt; font-weight: 700; color: #16a34a; }
    .barcode { width: 100%; max-width: 52mm; height: auto; }
    .qr { width: 18mm; height: 18mm; }
    .code { font-size: 8.5pt; color: #374151; letter-spacing: 0.5px; font-family: 'Courier New', monospace; }
    @media print { .sheet { gap: 0; } .label { border: none; } }
  </style></head><body><div class="sheet">${cards}</div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); });</script>
  </body></html>`;
}

async function printBridgeLabels(labels, columns, deviceName) {
  const hidden = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const html = printLabelHtml(labels, columns);
  try {
    await hidden.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const printed = await hidden.webContents.print({
      silent: Boolean(deviceName),
      deviceName: deviceName || undefined,
      printBackground: true,
    });
    return { success: printed };
  } catch (err) {
    return { success: false, message: String(err && err.message || err) };
  } finally {
    if (!hidden.isDestroyed()) hidden.destroy();
  }
}

// ---------------- Device inventory (printers + scanner) ----------------

const LABEL_PRINTER_HINTS = [
  /barcode/i, /label/i, /zebra/i, /godex/i, /dyemo/i, /dymo/i, /tsc(\s|-)?\d/i,
  /sato/i, /datamax/i, /brother/i, /gprinter/i, /tsp(\s|-)?\d/i, /fargo/i,
  /(\s|^)rl(\d|\s|$)/i, /xd(\d|$)/i, /tp-?\d/i, /gc-?\d/i, /cab(\s|$)/i, /psc/i,
];
const RECEIPT_PRINTER_HINTS = [
  /receipt/i, /bill/i, /thermal/i, /pos/i, /impact/i, /epson/i, /tm-?\d/i,
  /star(\s|$)/i, /hcc/i, /citizen/i, /custom/i, /bixolon/i, /dascom/i,
  /rongta/i, /huiju/i, /jolimark/i, /gtp/i, /eii/i, /sii/i, /srn\b/i,
];

function classifyPrinter(name) {
  const n = String(name || '');
  if (LABEL_PRINTER_HINTS.some((re) => re.test(n))) return 'label';
  if (RECEIPT_PRINTER_HINTS.some((re) => re.test(n))) return 'receipt';
  return 'general';
}

function bestPrinter(list, role) {
  const inRole = list.filter((p) => p.role === role);
  const chosen = inRole.find((p) => p.isDefault) || inRole[0];
  if (chosen) return chosen.name;
  if (role === 'receipt') {
    const def = list.find((p) => p.isDefault);
    if (def) return def.name;
  }
  return list[0] ? list[0].name : '';
}

async function getDevices() {
  let printers = [];
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const listed = await mainWindow.webContents.getPrintersAsync();
      printers = listed.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: Boolean(p.isDefault),
        role: classifyPrinter(p.name),
      }));
    }
  } catch {
    // Enumeration is best-effort; the window may not exist yet.
  }

  const now = Date.now();
  const last = scanLedger[0];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const scansToday = scanLedger.filter((e) => e.at >= dayStart.getTime()).length;

  return {
    version: APP_BRIDGE_VERSION,
    serviceMode,
    server: {
      serverUp: Boolean(wss),
      port: Number(config.port) || 9080,
      origin: config.origin,
      companyId: config.companyId,
      clients: wss ? wss.clients.size : 0,
    },
    scanner: {
      listening: captureActive,
      lastScanAt: last ? last.at : 0,
      lastCode: last ? last.code : '',
      scansToday,
    },
    printers,
    assigned: {
      label: config.labelPrinter || bestPrinter(printers, 'label'),
      receipt: config.receiptPrinter || bestPrinter(printers, 'receipt'),
    },
  };
}

// ---------------- Window + tray ----------------

function sendStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('status', {
    serverUp: Boolean(wss && wss.clients),
    clients: wss ? wss.clients.size : 0,
    port: Number(config.port) || 9080,
    origin: config.origin,
    companyId: config.companyId,
    captureActive,
    ledger: scanLedger.slice(0, 25),
    serviceMode,
  });
}

function showPortalWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createPortalWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showPortalWindow();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 800,
    minWidth: 840,
    minHeight: 600,
    title: 'ecbills Scanner Bridge',
    icon: getIcon(),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', showPortalWindow);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && captureActive) {
      if (handleCaptureKey(input.key)) {
        event.preventDefault();
      }
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    sendStatus();
    // Fallback for platforms where 'ready-to-show' never fires:
    // if the page rendered but the window is still hidden, surface it.
    if (!mainWindow.isVisible()) setTimeout(showPortalWindow, 250);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[bridge] Renderer crashed:', details && details.reason);
  });
  if (process.env.BRIDGE_DEBUG) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      console.log('[renderer]', level, message);
    });
  }
  if (process.env.BRIDGE_SCREENSHOT) {
    setTimeout(async () => {
      try {
        const image = await mainWindow.webContents.capturePage();
        const out = process.env.BRIDGE_SCREENSHOT;
        fs.writeFileSync(out, image.toPNG());
        console.log('[bridge] screenshot saved to', out);
      } catch (err) {
        console.error('[bridge] screenshot failed:', err && err.message);
      }
    }, 2000);
  }
}

function getIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  } catch {
    // ignore
  }
  return nativeImage.createEmpty();
}

function createTray() {
  tray = new Tray(getIcon());
  tray.setToolTip('ecbills Scanner Bridge');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Portal', click: () => createPortalWindow() },
    {
      label: 'Scanner Listening',
      type: 'checkbox',
      checked: captureActive,
      click: (item) => {
        captureActive = item.checked;
        scanBuffer = '';
        broadcast({ type: 'status', captureMode: captureActive ? 'window' : 'idle' });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scanner:set', captureActive);
        }
        sendStatus();
      },
    },
    { type: 'separator' },
    {
      label: `Service: 127.0.0.1:${Number(config.port) || 9080}`,
      enabled: false,
    },
    {
      label: 'Web Clients Connected',
      enabled: false,
      id: 'clients',
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => createPortalWindow());

  // Keep the "clients" menu item label fresh without rebuilding when unchanged.
  let lastClients = -1;
  setInterval(() => {
    const clients = wss ? wss.clients.size : 0;
    if (clients !== lastClients) {
      lastClients = clients;
      const item = contextMenu.getMenuItemById && contextMenu.getMenuItemById('clients');
      if (item) item.label = `Web Clients Connected: ${clients}`;
      if (!tray.isDestroyed()) tray.setContextMenu(contextMenu);
    }
  }, 2000);
}

// ---------------- IPC ----------------

function registerIpc() {
  ipcMain.handle('config:get', () => ({ ...config }));
  ipcMain.handle('config:set', (_event, partial) => {
    const previous = { ...config };
    const next = saveConfig(partial || {});
    // Restart the local server when the port changes.
    if (String(next.port) !== String(previous.port)) {
      if (wss) { try { wss.close(); } catch {} wss = null; }
      if (httpServer) { try { httpServer.close(); } catch {} httpServer = null; }
      startServer();
    }
    sendStatus();
    return next;
  });

  ipcMain.handle('status:get', () => ({
    serverUp: Boolean(wss),
    clients: wss ? wss.clients.size : 0,
    port: Number(config.port) || 9080,
    origin: config.origin,
    companyId: config.companyId,
    captureActive,
    ledger: scanLedger.slice(0, 25),
    serviceMode,
    version: APP_BRIDGE_VERSION,
  }));

  ipcMain.handle('devices:get', () => getDevices());

  ipcMain.handle('devices:assign', (_event, { role, name }) => {
    if (role === 'label') saveConfig({ labelPrinter: name });
    else if (role === 'receipt') saveConfig({ receiptPrinter: name });
    return getDevices();
  });

  ipcMain.handle('origin:check', (_event, origin) => checkOrigin(origin || config.origin));

  ipcMain.handle('scanner:set-active', (_event, active) => {
    captureActive = Boolean(active);
    scanBuffer = '';
    broadcast({ type: 'status', captureMode: captureActive ? 'window' : 'idle' });
    sendStatus();
    return captureActive;
  });

  ipcMain.handle('products:add', (_event, { productData, companyId }) =>
    addProduct(productData, companyId || config.companyId));

  ipcMain.handle('products:list', (_event, companyId) =>
    listProducts(companyId || config.companyId));

  ipcMain.handle('products:set-sku', (_event, { productId, companyId, sku }) =>
    setProductSku(productId, companyId || config.companyId, sku));

  ipcMain.handle('barcode:make', (_event, { text, type }) => makeBarcodeDataUrl(text, type));

  ipcMain.handle('labels:print', (_event, { labels, columns, deviceName }) =>
    printBridgeLabels(labels || [], columns, deviceName));

  ipcMain.handle('printers:list', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      isDefault: Boolean(printer.isDefault),
    }));
  });
}

// ---------------- Lifecycle ----------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => createPortalWindow());

  app.whenReady().then(() => {
    loadConfig();
    registerIpc();
    startServer();
    createTray();
    createPortalWindow();
  });

  app.on('window-all-closed', () => {
    // Stay alive in the tray on every platform; the portal window only ever hides.
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}