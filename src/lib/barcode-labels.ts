"use client";

import type { Product } from '@/types';
import { triggerPrint } from '@/lib/print-utils';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fetchBarcodeDataUrl = async (text: string, type: 'barcode' | 'qr'): Promise<string | null> => {
  try {
    const response = await fetch(`/api/barcode?text=${encodeURIComponent(text)}&type=${type}`);
    const result = await response.json();
    return result.success ? (result.dataUrl as string) : null;
  } catch {
    return null;
  }
};

export interface BarcodeLabelOptions {
  columns?: number;
  showQr?: boolean;
  showPrice?: boolean;
  copies?: number;
}

export const printBarcodeLabels = async (products: Product[], options: BarcodeLabelOptions = {}): Promise<{
  success: boolean;
  printed: number;
  skipped: string[];
}> => {
  const columns = options.columns || 3;
  const copies = options.copies || 1;
  const showQr = options.showQr ?? true;
  const showPrice = options.showPrice ?? false;

  const skipped: string[] = [];
  const labels: string[] = [];

  for (const product of products) {
    const code = (product.sku || '').trim() || product.name.trim();
    if (!code) {
      skipped.push(product.name);
      continue;
    }

    const [barcode, qr] = await Promise.all([
      fetchBarcodeDataUrl(code, 'barcode'),
      showQr ? fetchBarcodeDataUrl(code, 'qr') : Promise.resolve(null),
    ]);
    if (!barcode && !qr) {
      skipped.push(product.name);
      continue;
    }

    for (let i = 0; i < copies; i++) {
      labels.push(`
        <div class="label">
          ${qr ? `<img class="qr" src="${qr}" alt="QR" />` : ''}
          <div class="name">${escapeHtml(product.name)}</div>
          ${showPrice && product.productSKUs[0]?.stockLayers?.[0]?.sellPrice ? `<div class="price">&#8377;${product.productSKUs[0].stockLayers[0].sellPrice.toFixed(2)}</div>` : ''}
          ${barcode ? `<img class="barcode" src="${barcode}" alt="${escapeHtml(code)}" />` : ''}
          <div class="code">${escapeHtml(code)}</div>
        </div>
      `);
    }
  }

  if (labels.length === 0) {
    return { success: false, printed: 0, skipped };
  }

  const content = `<html><head><title>Barcode Labels</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 10px; background: #fff; }
    @page { size: auto; margin: 8mm; }
    .sheet { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 6mm; }
    .label { border: 1px solid #d1d5db; border-radius: 4px; padding: 6mm 4mm; text-align: center; break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2mm; }
    .name { font-size: 11pt; font-weight: 600; color: #111827; line-height: 1.15; }
    .price { font-size: 12pt; font-weight: 700; color: #16a34a; }
    .barcode { width: 100%; max-width: 52mm; height: auto; }
    .qr { width: 18mm; height: 18mm; }
    .code { font-size: 8.5pt; color: #374151; letter-spacing: 0.5px; font-family: 'Courier New', monospace; }
    @media print { .sheet { gap: 0; } .label { border: none; } }
  </style></head><body>
    <div class="sheet">${labels.join('')}</div>
    <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 300); });</script>
  </body></html>`;

  triggerPrint(content);
  return { success: true, printed: labels.length, skipped };
};