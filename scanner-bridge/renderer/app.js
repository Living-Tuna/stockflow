'use strict';

const bridge = window.ecbillsBridge;

const $ = (id) => document.getElementById(id);

let config = {};
let products = [];
let linkedProductId = '';
let captureEnabled = false;
let isEditing = false;
let devices = null;

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------- Helpers ----------
const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function setNote(id, text, kind) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'note' + (kind ? ' ' + kind : '');
}

const timeFmt = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

async function refreshProducts() {
  const companyId = config.companyId;
  if (!companyId) {
    setNote('linkResult', 'Set a Company ID first (Connection tab).', 'error');
    return;
  }
  const res = await bridge.listProducts(companyId);
  if (!res.success) {
    setNote('linkResult', 'Could not load products: ' + (res.message || 'unknown error'), 'error');
    return;
  }
  products = (res.data || [])
    .filter((p) => !p.isArchived)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const linkSelect = $('productSelect');
  linkSelect.innerHTML = '<option value="">-- select a product --</option>' +
    products.map((p) => `<option value="${p.id}">${esc(p.name)}${p.sku ? '  [' + esc(p.sku) + ']' : ''}</option>`).join('');
  if (linkedProductId) linkSelect.value = linkedProductId;

  $('labelProductSelect').innerHTML = products
    .map((p) => `<option value="${p.id}">${esc(p.name)}${p.sku ? '  [' + esc(p.sku) + ']' : ''}</option>`)
    .join('');

  const list = $('savedProductList');
  list.innerHTML = products.slice(0, 20).map((p) => `
    <li>
      <span>${esc(p.name)}${p.category ? ' - ' + esc(p.category) : ''}</span>
      <span class="sku">${esc(p.sku || 'no barcode')}</span>
    </li>`).join('') || '<li class="note">No products found.</li>';
}

function renderStatus(status) {
  const mk = (label, ok) => `<span class="pill ${ok ? 'ok' : 'bad'}">${esc(label)}</span>`;
  $('statusPills').innerHTML =
    mk('Bridge: ws://127.0.0.1:' + (status.port || 9080), true) +
    mk('Web clients: ' + (status.clients || 0), (status.clients || 0) > 0) +
    mk('Scanner: ' + (status.captureActive ? 'LISTENING' : 'standby'), status.captureActive);

  const effective = captureEnabled && !isEditing;
  $('scannerActive').checked = captureEnabled;
  $('scannerToggleScan').checked = captureEnabled;
  $('scannerStateTitle').textContent = `Scanner Listening: ${effective ? 'ON' : captureEnabled ? 'PAUSED (typing)' : 'OFF'}`;
  $('scannerStateTitle2').textContent = `Scanner Listening: ${effective ? 'ON' : captureEnabled ? 'PAUSED (typing)' : 'OFF'}`;
}

const ROLE_LABEL = { label: 'Label / barcode', receipt: 'Bill / receipt', general: 'General' };

function printerOptions(dev, preferredRole) {
  if (!dev || !dev.printers || dev.printers.length === 0) {
    return '<option value="">No printers detected</option>';
  }
  const roleRank = (r) => (r === preferredRole ? 0 : r === 'general' ? 1 : 2);
  const sorted = dev.printers.slice().sort((a, b) => roleRank(a.role) - roleRank(b.role));
  return sorted.map((p) =>
    `<option value="${esc(p.name)}">${esc(p.displayName || p.name)} · ${ROLE_LABEL[p.role] || 'General'}${p.isDefault ? ' (default)' : ''}</option>`
  ).join('');
}

function renderDevices(dev) {
  if (!dev) return;
  devices = dev;
  const { scanner, printers, assigned, server, version, serviceMode } = dev;

  // ---- Barcode Reader card ----
  const readerBadge = $('readerBadge');
  readerBadge.className = 'badge ' + (scanner.listening ? 'on' : 'off');
  readerBadge.innerHTML = `<span class="dot"></span>${scanner.listening ? 'LISTENING' : 'Standby'}`;
  $('devScansToday').textContent = scanner.scansToday || 0;
  $('devScansToday').classList.toggle('on', scanner.listening);
  $('devLastScan').textContent = timeFmt(scanner.lastScanAt);
  $('devLastCode').textContent = scanner.lastCode || '—';

  // ---- Printer cards ----
  $('labelPrinterSelect').innerHTML = printerOptions(dev, 'label');
  $('labelPrinterSelect').value = assigned.label || '';
  $('receiptPrinterSelect').innerHTML = printerOptions(dev, 'receipt');
  $('receiptPrinterSelect').value = assigned.receipt || '';

  const noPrinters = !printers || printers.length === 0;
  const labelBadge = $('labelBadge');
  labelBadge.className = 'badge ' + (noPrinters ? 'off' : 'on');
  labelBadge.innerHTML = `<span class="dot"></span>${noPrinters ? 'Not found' : 'Connected'}`;
  const receiptBadge = $('receiptBadge');
  receiptBadge.className = 'badge ' + (noPrinters ? 'off' : 'on');
  receiptBadge.innerHTML = `<span class="dot"></span>${noPrinters ? 'Not found' : 'Connected'}`;

  // ---- Web App Sync card ----
  const syncBadge = $('syncBadge');
  if (server.clients > 0) {
    syncBadge.className = 'badge on';
    syncBadge.innerHTML = `<span class="dot"></span>${server.clients} live${server.clients === 1 ? ' client' : ' clients'}`;
  } else if (server.serverUp) {
    syncBadge.className = 'badge checking';
    syncBadge.innerHTML = 'Online · no clients';
  } else {
    syncBadge.className = 'badge off';
    syncBadge.innerHTML = '<span class="dot"></span>Offline';
  }

  $('serviceStatus').innerHTML = `
    <li><span>Local server</span><b>ws://127.0.0.1:${server.port} <span style="opacity:.6">(${esc(serviceMode || '')})</span></b></li>
    <li><span>Web billing clients</span><b>${server.clients || 0}</b></li>
    <li><span>Web app URL</span><b>${esc(server.origin || '--')}</b></li>
    <li><span>Company ID</span><b>${esc(server.companyId || '--')}</b></li>
    <li><span>Health endpoint</span><b>http://127.0.0.1:${server.port}/health</b></li>
    <li><span>Bridge version</span><b>v${version}</b></li>
  `;

  $('bridgeVersion').textContent = 'v' + version;
  $('footVersion').textContent = 'v' + version;
  $('devicesUpdated').textContent = 'Updated ' + timeFmt(Date.now());
}

function renderScans(ledger) {
  const list = $('scanList');
  list.innerHTML = ledger.map((e) => {
    const linked = e.linkedTo ? ` -> linked to ${esc(e.linkedTo)}` : '';
    return `<li><span>${esc(e.code)}</span><time>${timeFmt(e.at)}${linked}</time></li>`;
  }).join('') || '<li class="note" style="border:none;background:transparent">No scans yet. Enable listening and scan.</li>';
  $('scanCount').textContent = ledger.length;
}

function applyScannerActive() {
  bridge.setScannerActive(captureEnabled && !isEditing);
  if (devices) devices.scanner.listening = captureEnabled;
}

function flashReader() {
  const card = $('card-reader');
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 700);
}

async function loadDevices() {
  try {
    const dev = await bridge.getDevices();
    renderDevices(dev);
  } catch {
    // bridge may not be ready yet
  }
}

// ---------- Focus tracking (don't capture manual typing) ----------
document.addEventListener('focusin', (e) => {
  const t = e.target;
  isEditing = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
  applyScannerActive();
});
document.addEventListener('focusout', () => {
  isEditing = false;
  applyScannerActive();
});

// ---------- Scanner toggles (Devices + Scanner tabs stay in sync) ----------
function bindScannerToggle(el) {
  el.addEventListener('change', (e) => {
    captureEnabled = e.target.checked;
    $('scannerActive').checked = captureEnabled;
    $('scannerToggleScan').checked = captureEnabled;
    applyScannerActive();
  });
}
bindScannerToggle($('scannerActive'));
bindScannerToggle($('scannerToggleScan'));

if (bridge.onScannerSet) {
  bridge.onScannerSet(async (active) => {
    captureEnabled = Boolean(active);
    applyScannerActive();
    renderStatus(await bridge.getStatus());
    loadDevices();
  });
}

bridge.onScan((entry) => {
  const recent = [entry].concat(document.__recentScans || []).slice(0, 25);
  document.__recentScans = recent;
  renderScans(recent);
  flashReader();
  loadDevices();

  // Auto-link the scanned barcode to the currently selected product.
  if (linkedProductId && config.companyId) {
    const product = products.find((p) => p.id === linkedProductId);
    if (product) {
      bridge.setProductSku(linkedProductId, config.companyId, entry.code).then((res) => {
        if (res.success) {
          entry.linkedTo = product.name;
          renderScans(document.__recentScans || []);
          setNote('linkResult', `Stored barcode "${entry.code}" on "${product.name}".`, 'good');
          refreshProducts();
        } else {
          setNote('linkResult', 'Could not store barcode: ' + (res.message || 'unknown'), 'error');
        }
      });
    }
  }
});

// ---------- Printer assignment --------------
async function onPrinterAssign(role, selectId) {
  const name = $(selectId).value;
  if (!name || !devices) return;
  const dev = await bridge.assignDevice(role, name);
  renderDevices(dev);
  setNote(role === 'label' ? 'labelResult' : 'receiptResult',
    `Saved. ${role === 'label' ? 'Labels' : 'Bills'} will go to "${name}".`, 'good');
}
$('labelPrinterSelect').addEventListener('change', () => onPrinterAssign('label', 'labelPrinterSelect'));
$('receiptPrinterSelect').addEventListener('change', () => onPrinterAssign('receipt', 'receiptPrinterSelect'));

// ---------- Test prints ----------
async function printTest(role, resultNote) {
  if (!devices) return;
  const name = role === 'label' ? devices.assigned.label : devices.assigned.receipt;
  if (!name) {
    setNote(resultNote, 'No target printer detected. Plug in or set the correct printer.', 'error');
    return;
  }
  setNote(resultNote, 'Test printing to "' + name + '"...');
  const code = role === 'label' ? 'ECB-TEST-' + Math.random().toString(36).slice(2, 5).toUpperCase() : 'ECB-BILL';
  const label = {
    code,
    name: role === 'label' ? 'ecbills Test Label' : 'ecbills Test Bill',
    qr: null,
  };
  const b = await bridge.makeBarcode(code, 'barcode');
  label.barcode = b && b.dataUrl;
  if (role === 'receipt') label.price = 0;
  const res = await bridge.printLabels([label], 1, name);
  setNote(resultNote, res.success ? 'Printed a test ' + (role === 'label' ? 'label!' : 'bill!') + ' Check your ' + name + '.'
    : 'Print failed: ' + (res.message || 'unknown'), res.success ? 'good' : 'error');
}
$('labelTestBtn').addEventListener('click', () => printTest('label', 'labelResult'));
$('receiptTestBtn').addEventListener('click', () => printTest('receipt', 'receiptResult'));

// ---------- Connection ----------
async function loadConfig() {
  config = await bridge.getConfig();
  $('origin').value = config.origin || '';
  $('companyId').value = config.companyId || '';
  $('port').value = config.port || '9080';
}

$('saveConfig').addEventListener('click', async () => {
  const origin = $('origin').value.trim().replace(/\/+$/, '');
  const companyId = $('companyId').value.trim();
  const port = parseInt($('port').value, 10) || 9080;
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    setNote('connectResult', 'Web App URL must start with http:// or https://', 'error');
    return;
  }
  config = await bridge.setConfig({ origin, companyId, port });
  setNote('connectResult', `Saved. Bridge listening on 127.0.0.1:${port}.`, 'good');
  renderStatus(await bridge.getStatus());
  loadDevices();
});

$('syncTestBtn').addEventListener('click', async () => {
  const origin = (config.origin || '').trim().replace(/\/+$/, '');
  setNote('originResult', 'Testing ' + (origin || 'not configured') + ' ...');
  if (!origin) {
    setNote('originResult', 'Set a Web App URL on the Connection tab first.', 'error');
    return;
  }
  const res = await bridge.checkOrigin(origin);
  if (res.success) {
    setNote('originResult', `Reachable (HTTP ${res.status}). The bridge can reach your web app.`, 'good');
  } else {
    setNote('originResult', 'Not reachable. Is "npm run dev" (port 9002) or the desktop app running?', 'error');
  }
});

// ---------- Add product ----------
$('addProduct').addEventListener('click', async () => {
  const name = $('productName').value.trim();
  if (!name) {
    setNote('addProductResult', 'Product name is required.', 'error');
    return;
  }
  if (!config.companyId) {
    setNote('addProductResult', 'Set a Company ID first (Connection tab).', 'error');
    return;
  }
  const btn = $('addProduct');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  const productData = {
    name,
    category: $('productCategory').value.trim() || undefined,
    unit: $('productUnit').value || 'nos',
    description: $('productDesc').value.trim() || undefined,
    hsnCode: $('productHsn').value.trim() || undefined,
    trackQuantity: $('productTrack').checked,
    costPrice: $('productCost').value ? parseFloat($('productCost').value) : undefined,
    sellPrice: $('productSell').value ? parseFloat($('productSell').value) : undefined,
    initialStock: $('productStock').value ? parseFloat($('productStock').value) : undefined,
    variants: [],
    additionalChargeDefinitions: [],
  };

  const res = await bridge.addProduct(productData, config.companyId);
  btn.disabled = false;
  btn.textContent = 'Add Product to Company';

  if (res.success && res.data) {
    setNote('addProductResult', `Created "${res.data.name}". You can now link or generate a barcode below.`, 'good');
    linkedProductId = res.data.id;
    refreshProducts();
    $('productName').value = '';
  } else {
    setNote('addProductResult', 'Failed: ' + (res.message || 'unknown error'), 'error');
  }
});

// ---------- Barcode linking ----------
$('productSelect').addEventListener('change', (e) => {
  linkedProductId = e.target.value;
  $('barcodePreview').classList.add('hidden');
  $('barcodeImg').src = '';
  $('barcodeText').textContent = '';
  setNote('linkResult', '', null);
});

$('refreshProducts').addEventListener('click', refreshProducts);

function generateCode() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ECB-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

$('generateBarcode').addEventListener('click', async () => {
  if (!linkedProductId || !config.companyId) {
    setNote('linkResult', 'Select a product first.', 'error');
    return;
  }
  const code = generateCode();
  const res = await bridge.setProductSku(linkedProductId, config.companyId, code);
  if (!res.success) {
    setNote('linkResult', 'Could not store barcode: ' + (res.message || 'unknown'), 'error');
    return;
  }
  const product = products.find((p) => p.id === linkedProductId);
  const barcode = await bridge.makeBarcode(code, 'barcode');
  $('barcodeImg').src = barcode.dataUrl;
  $('barcodeText').textContent = code;
  $('barcodePreview').classList.remove('hidden');
  setNote('linkResult', `Generated and stored barcode "${code}" on "${product ? product.name : 'product'}".`, 'good');
  refreshProducts();
});

$('printBarcodeLabel').addEventListener('click', async () => {
  const code = $('barcodeText').textContent.trim();
  if (!code) return;
  const product = products.find((p) => p.id === linkedProductId);
  const [barcode, qr] = await Promise.all([bridge.makeBarcode(code, 'barcode'), bridge.makeBarcode(code, 'qr')]);
  const res = await bridge.printLabels([
    { code, name: product ? product.name : code, barcode: barcode.dataUrl, qr: qr.dataUrl },
  ], 1, devices ? devices.assigned.label : '');
  if (!res.success) {
    setNote('linkResult', 'Print failed: ' + (res.message || 'unknown'), 'error');
  } else {
    setNote('linkResult', 'Label sent to ' + (devices && devices.assigned.label ? devices.assigned.label : 'printer') + '.', 'good');
  }
});

// ---------- Labels ----------
$('printSelectedLabels').addEventListener('click', async () => {
  const selectedIds = Array.from($('labelProductSelect').selectedOptions || []).map((o) => o.value);
  if (selectedIds.length === 0) {
    setNote('labelsResult', 'Select at least one product.', 'error');
    return;
  }
  const copies = parseInt($('labelCopies').value, 10) || 1;
  const withQr = $('labelQr').checked;
  const withPrice = $('labelPrice').checked;
  const labels = [];
  setNote('labelsResult', 'Generating labels...');
  for (const id of selectedIds) {
    const p = products.find((x) => x.id === id);
    if (!p) continue;
    const code = (p.sku || p.name || '').trim();
    if (!code) continue;
    const [barcode, qr] = await Promise.all([
      bridge.makeBarcode(code, 'barcode'),
      withQr ? bridge.makeBarcode(code, 'qr') : Promise.resolve({ dataUrl: null }),
    ]);
    let price = null;
    if (withPrice && p.productSKUs && p.productSKUs[0] && p.productSKUs[0].stockLayers) {
      const layer = p.productSKUs[0].stockLayers.find((l) => l.sellPrice > 0);
      price = layer ? layer.sellPrice : null;
    }
    for (let i = 0; i < copies; i++) {
      labels.push({ code, name: p.name, barcode: barcode.dataUrl, qr: qr.dataUrl, price });
    }
  }
  if (labels.length === 0) {
    setNote('labelsResult', 'No labels could be built. Make sure selected products have a SKU.', 'error');
    return;
  }
  const res = await bridge.printLabels(labels, 3, devices ? devices.assigned.label : '');
  setNote('labelsResult', res.success
    ? `Sent ${labels.length} label(s) to ` + (devices && devices.assigned.label ? devices.assigned.label : 'the printer') + '.'
    : 'Print failed: ' + (res.message || 'unknown'), res.success ? 'good' : 'error');
});

// ---------- Init ----------
(async function init() {
  await loadConfig();
  const status = await bridge.getStatus();
  captureEnabled = Boolean(status.captureActive);
  document.__recentScans = status.ledger || [];
  renderStatus(status);
  renderScans(status.ledger || []);
  refreshProducts();
  loadDevices();

  bridge.onStatus((nextStatus) => {
    renderStatus(nextStatus);
    if (nextStatus.ledger) {
      document.__recentScans = nextStatus.ledger;
      renderScans(nextStatus.ledger);
    }
  });

  setInterval(loadDevices, 2500);
})();