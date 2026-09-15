'use strict';

const bridge = window.ecbillsBridge;

const $ = (id) => document.getElementById(id);

let config = {};
let products = [];
let linkedProductId = '';
let captureEnabled = false;
let isEditing = false;

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
  el.textContent = text || '';
  el.className = 'note' + (kind ? ' ' + kind : '');
}

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
    mk('Bridge: 127.0.0.1:' + (status.port || 9080), true) +
    mk('Web clients: ' + (status.clients || 0), (status.clients || 0) > 0) +
    mk('Scanner: ' + (status.captureActive ? 'LISTENING' : 'standby'), status.captureActive);

  $('serviceStatus').innerHTML = `
    <li><span>Local server</span><b>ws://127.0.0.1:${status.port || 9080} <span style="opacity:.6">(${esc(status.serviceMode || '')})</span></b></li>
    <li><span>Connected web billing clients</span><b>${status.clients || 0}</b></li>
    <li><span>Scanner capture</span><b>${status.captureActive ? 'LISTENING (window focused)' : 'standby'}</b></li>
    <li><span>Web app URL</span><b>${esc(status.origin || '--')}</b></li>
    <li><span>Company ID</span><b>${esc(status.companyId || '--')}</b></li>
    <li><span>Health endpoint</span><b>http://127.0.0.1:${status.port || 9080}/health</b></li>
  `;

  const effective = captureEnabled && !isEditing;
  $('scannerActive').checked = captureEnabled;
  $('scannerStateTitle').textContent = `Scanner Listening: ${effective ? 'ON' : captureEnabled ? 'PAUSED (typing)' : 'OFF'}`;
}

function renderScans(ledger) {
  const list = $('scanList');
  list.innerHTML = ledger.map((e) => {
    const linked = e.linkedTo ? ` -> linked to ${esc(e.linkedTo)}` : '';
    return `<li><span>${esc(e.code)}</span><time>${new Date(e.at).toLocaleTimeString()}${linked}</time></li>`;
  }).join('') || '<li class="note">No scans yet. Enable listening and scan.</li>';
  $('scanCount').textContent = ledger.length;
}

function applyScannerActive() {
  bridge.setScannerActive(captureEnabled && !isEditing);
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
    setNote('originResult', 'Web App URL must start with http:// or https://', 'error');
    return;
  }
  config = await bridge.setConfig({ origin, companyId, port });
  setNote('originResult', `Saved. Bridge listening on 127.0.0.1:${port}.`, 'good');
  renderStatus(await bridge.getStatus());
});

$('checkOrigin').addEventListener('click', async () => {
  const origin = $('origin').value.trim().replace(/\/+$/, '');
  setNote('originResult', 'Testing ' + origin + ' ...');
  const res = await bridge.checkOrigin(origin);
  if (res.success) {
    setNote('originResult', `Reachable (HTTP ${res.status}). The bridge can reach your web app.`, 'good');
  } else {
    setNote('originResult', `Not reachable. Is "npm run dev" (port 9002) or the desktop app running?`, 'error');
  }
});

// ---------- Scanner ----------
$('scannerActive').addEventListener('change', (e) => {
  captureEnabled = e.target.checked;
  applyScannerActive();
});

if (bridge.onScannerSet) {
  bridge.onScannerSet(async (active) => {
    captureEnabled = Boolean(active);
    applyScannerActive();
    renderStatus(await bridge.getStatus());
  });
}

bridge.onScan((entry) => {
  const recent = [entry].concat(document.__recentScans || []).slice(0, 25);
  document.__recentScans = recent;
  renderScans(recent);

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
  ], 1, '');
  if (!res.success) {
    setNote('linkResult', 'Print failed: ' + (res.message || 'unknown'), 'error');
  } else {
    setNote('linkResult', 'Label sent to printer.', 'good');
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
  const res = await bridge.printLabels(labels, 3, '');
  setNote('labelsResult', res.success
    ? `Sent ${labels.length} label(s) to the printer.`
    : 'Print failed: ' + (res.message || 'unknown'), res.success ? 'good' : 'error');
});

// ---------- Init ----------
(async function init() {
  await loadConfig();
  const status = await bridge.getStatus();
  document.__recentScans = status.ledger || [];
  renderStatus(status);
  renderScans(status.ledger || []);
  refreshProducts();
  bridge.onStatus((nextStatus) => {
    renderStatus(nextStatus);
    if (nextStatus.ledger) {
      document.__recentScans = nextStatus.ledger;
      renderScans(nextStatus.ledger);
    }
  });
})();