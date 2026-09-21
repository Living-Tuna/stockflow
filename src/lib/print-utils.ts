
import { format } from 'date-fns';
import type { Bill, BillItem, ProductSKU, Product, UserProfile } from '@/types';
import { DEFAULT_COMPANY_NAME, COMPANY_ADDRESS, COMPANY_CONTACT } from '@/lib/constants';
import { getCurrencySymbol } from './utils'; // Import the new helper
import { SELECTED_PRINTER_STORAGE_KEY, getPaperFormat, type PaperFormat } from '@/lib/printer-settings';

// Helper function to get SKU details - simplified, assumes product and SKU exist
const getProductSkuForPrint = (
  productId: string,
  selectedOptions: Record<string, string> | undefined,
  products: Product[]
): ProductSKU | undefined => {
  const product = products.find(p => p.id === productId);
  if (!product) return undefined;
  if (productId.startsWith('SERVICE_ITEM_') || productId.startsWith('CHARGE_ITEM_')) return undefined;

  const targetOptionValues = selectedOptions || {};
  return product.productSKUs.find(sku =>
    JSON.stringify(Object.fromEntries(Object.entries(sku.optionValues).sort())) ===
    JSON.stringify(Object.fromEntries(Object.entries(targetOptionValues).sort()))
  );
};


const getBillTypeNameForPrint = (bill: Bill): string => {
  if (bill.type === 'buy') return 'Purchase Bill';
  if (bill.type === 'sell' && bill.isEstimate) return 'Estimate';
  if (bill.type === 'sell') return 'Tax Invoice';
  if (bill.type === 'return' && bill.returnType === 'exchange') return 'Exchange';
  if (bill.type === 'return' && bill.items.some(item => item.isDefective)) return 'Return (Defective)';
  if (bill.type === 'return') return 'Return';
  return 'Bill';
};

const getPartyDetailsTitleForPrint = (billType: Bill['type']): string => {
  if (billType === 'buy') return 'Vendor Details';
  if (billType === 'sell' || billType === 'return') return 'Customer Details';
  return 'Party Details';
};

const getPartyNameLabelForPrint = (billType: Bill['type']): string => {
  if (billType === 'buy') return 'Vendor Name';
  if (billType === 'sell' || billType === 'return') return 'Customer Name';
  return 'Name';
};


export const generateBillPrintContent = (
  billToPrint: Bill,
  userProfile: UserProfile | undefined,
  products: Product[]
): string => {
  const currencySymbol = getCurrencySymbol(userProfile?.companyCurrency);
  let content = '<html><head><title>Print Bill</title>';
  const styles =
    "<style>\n" +
    "  body { font-family: 'Open Sans', Arial, sans-serif; margin: 0; padding: 15px; line-height: 1.35; color: #1f2937; font-size: 9pt; background: #fff; }\n" +
    "  @page { size: auto; margin: 5mm; }\n" +
    "  .print-container { width: 100%; max-width: 100%; margin: 0; border: 1px solid #e5e7eb; }\n" +
    "  .header { text-align: center; padding: 15px; border-bottom: 2px solid #374151; background-color: #f9fafb; }\n" +
    "  .header h1 { margin: 0 0 5px 0; font-size: 18pt; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; }\n" +
    "  .header p { margin: 2px 0; font-size: 9pt; color: #4b5563; }\n" +
    "  .bill-title-box { text-align: center; margin: 10px 0; border-top: 1px dashed #d1d5db; border-bottom: 1px dashed #d1d5db; padding: 5px 0; }\n" +
    "  .bill-title-box h2 { margin: 0; font-size: 12pt; font-weight: 600; text-transform: uppercase; color: #374151; }\n" +
    "  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 15px; border-bottom: 1px solid #e5e7eb; }\n" +
    "  .info-block h4 { margin: 0 0 5px 0; font-size: 10pt; font-weight: 700; color: #111827; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; width: fit-content; }\n" +
    "  .info-block p { margin: 2px 0; font-size: 9pt; }\n" +
    "  table { width: 100%; border-collapse: collapse; margin-top: 0; font-size: 9pt; }\n" +
    "  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }\n" +
    "  th { background-color: #f3f4f6; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 8pt; }\n" +
    "  .text-right { text-align: right; }\n" +
    "  .text-center { text-align: center; }\n" +
    "  .font-medium { font-weight: 600; }\n" +
    "  .font-bold { font-weight: 700; }\n" +
    "  .total-section { display: flex; justify-content: flex-end; padding: 10px 15px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }\n" +
    "  .total-table { width: auto; min-width: 250px; border: none; }\n" +
    "  .total-table td { border: none; padding: 3px 0; }\n" +
    "  .total-table .final-total { border-top: 1px solid #d1d5db; border-bottom: 1px double #374151; font-weight: bold; font-size: 11pt; padding: 5px 0; color: #000; margin-top: 5px; }\n" +
    "  .notes-section { padding: 10px 15px; font-size: 8.5pt; color: #4b5563; border-top: 1px solid #e5e7eb; }\n" +
    "  .footer { text-align: center; font-size: 8pt; color: #9ca3af; padding: 10px; border-top: 1px solid #e5e7eb; }\n" +
    "  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; }\n" +
    "  .badge-paid { background-color: #dcfce7; color: #166534; border: 1px solid #86efac; }\n" +
    "  .badge-unpaid { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }\n" +
    "</style>\n";
  content += styles;
  content += '</head><body>';
  content += '<div class="print-container">';

  // Header
  content += '<div class="header">';
  content += `<h1>${userProfile?.companyName || DEFAULT_COMPANY_NAME}</h1>`;
  content += `<p>${userProfile?.companyAddress || COMPANY_ADDRESS}</p>`;
  content += `<p>Phone: ${userProfile?.companyPhone || 'N/A'} | Email: ${userProfile?.companyEmail || 'N/A'}</p>`;
  if (userProfile?.companyGstNo) {
    content += `<p style="font-weight: 600; margin-top: 4px;">GSTIN: ${userProfile.companyGstNo}</p>`;
  }
  content += '</div>';

  const billTitle = billToPrint.type === 'sell' && billToPrint.isEstimate ? 'ESTIMATE / QUOTATION' :
    (billToPrint.type === 'sell' ? 'TAX INVOICE' : getBillTypeNameForPrint(billToPrint).toUpperCase());

  content += `<div class="bill-title-box"><h2>${billTitle}</h2></div>`;

  // Info Grid (Customer & Bill Details)
  content += '<div class="info-grid">';

  // Left: Bill To
  content += '<div class="info-block">';
  content += `<h4>${getPartyDetailsTitleForPrint(billToPrint.type)}</h4>`;
  if (billToPrint.vendorOrCustomerName) content += `<p><strong>${getPartyNameLabelForPrint(billToPrint.type)}:</strong> ${billToPrint.vendorOrCustomerName}</p>`;
  if (billToPrint.customerPhone) content += `<p><strong>Phone:</strong> ${billToPrint.customerPhone}</p>`;
  if (billToPrint.billingAddress) content += `<p><strong>Address:</strong> ${billToPrint.billingAddress}</p>`;
  if (billToPrint.gstin) content += `<p><strong>Partys GSTIN:</strong> ${billToPrint.gstin}</p>`;
  if (billToPrint.placeOfSupply) content += `<p><strong>Place of Supply:</strong> ${billToPrint.placeOfSupply}</p>`;
  content += '</div>';

  // Right: Bill Info
  content += '<div class="info-block text-right">';
  content += `<h4>Invoice Details</h4>`;
  content += `<p><strong>Invoice No:</strong> ${billToPrint.invoiceNumber || billToPrint.id.substring(0, 8).toUpperCase()}</p>`; // Fallback to ID stub if no invoice number
  content += `<p><strong>Date:</strong> ${format(new Date(billToPrint.date), 'dd-MMM-yyyy')}</p>`;
  if (billToPrint.paymentStatus && !billToPrint.isEstimate) {
    const status = billToPrint.paymentStatus === 'paid' ? 'Paid' : 'Unpaid';
    const badgeClass = billToPrint.paymentStatus === 'paid' ? 'badge-paid' : 'badge-unpaid';
    content += `<p><strong>Status:</strong> <span class="badge ${badgeClass}">${status}</span></p>`;
  }
  if (billToPrint.billedByStaffName) content += `<p><strong>Issued By:</strong> ${billToPrint.billedByStaffName}</p>`;
  if (billToPrint.type === 'return') {
    content += `<p><strong>Against Bill:</strong> ${billToPrint.originalBillId || '-'}</p>`;
    if (billToPrint.returnType === 'exchange') content += `<p><strong>Type:</strong> Exchange (like-for-like, no refund)</p>`;
  }
  content += '</div>';

  content += '</div>'; // End info-grid

  // Items Table
  content += '<div class="items-section">';
  const showTaxDetailsInItems = billToPrint.type === 'sell' && !billToPrint.isEstimate;

  content += '<table><thead><tr>';
  content += '<th style="width: 30px;">#</th>';
  content += '<th>Item Description</th>';
  content += '<th class="text-center" style="width: 60px;">HSN</th>';
  content += '<th class="text-right" style="width: 50px;">Qty</th>';
  content += '<th class="text-right" style="width: 80px;">Rate</th>';
  if (showTaxDetailsInItems) {
    content += '<th class="text-right" style="width: 70px;">Taxable</th>';
    if (billToPrint.taxType === 'inter-state') {
      content += '<th class="text-right" style="width: 60px;">IGST</th>';
    } else {
      content += '<th class="text-right" style="width: 60px;">SGST</th>';
      content += '<th class="text-right" style="width: 60px;">CGST</th>';
    }
  }
  content += '<th class="text-right" style="width: 90px;">Total</th>';
  content += '</tr></thead><tbody>';

  billToPrint.items.forEach((item, index) => {
    // Attempt to find product to get HSN if not on item (though usually it should be on item snapshot if we stored it, but we can look up)
    const product = products.find(p => p.id === item.productId);
    const hsn = product?.hsnCode || '-';

    // Calculations
    const sellPrice = typeof item.sellPrice === 'number' ? item.sellPrice : 0;
    const itemTotal = item.quantity * sellPrice;
    const discount = item.discountAmount || 0;
    const taxableValue = Math.max(0, itemTotal - discount);

    const sgst = item.sgstAmount || 0;
    const cgst = item.cgstAmount || 0;
    const igst = item.igstAmount || 0;
    const finalAmount = taxableValue + sgst + cgst + igst;

    content += '<tr>';
    content += `<td>${index + 1}</td>`;
    content += `<td><span class="font-medium">${item.productName}</span>`;
    if (item.selectedVariantOptions && Object.keys(item.selectedVariantOptions).length > 0) {
      content += `<div style="font-size: 8pt; color: #6b7280; font-style: italic;">${Object.values(item.selectedVariantOptions).join(', ')}</div>`;
    }
    content += `</td>`;
    content += `<td class="text-center">${hsn}</td>`;
    content += `<td class="text-right">${item.quantity}</td>`;
    content += `<td class="text-right">${currencySymbol}${sellPrice.toFixed(2)}</td>`;

    if (showTaxDetailsInItems) {
      content += `<td class="text-right">${currencySymbol}${taxableValue.toFixed(2)}</td>`;
      if (billToPrint.taxType === 'inter-state') {
        content += `<td class="text-right">${currencySymbol}${igst.toFixed(2)}</td>`;
      } else {
        content += `<td class="text-right">${currencySymbol}${sgst.toFixed(2)}</td>`;
        content += `<td class="text-right">${currencySymbol}${cgst.toFixed(2)}</td>`;
      }
    }
    content += `<td class="text-right font-bold">${currencySymbol}${finalAmount.toFixed(2)}</td>`;
    content += '</tr>';
  });
  content += '</tbody></table>';
  content += '</div>';

  // Summary Section
  content += '<div class="total-section">';
  content += '<table class="total-table">';
  content += `<tr><td class="text-right">Subtotal:</td><td class="text-right font-medium">${currencySymbol}${billToPrint.subTotal?.toFixed(2) || '0.00'}</td></tr>`;

  if (billToPrint.totalDiscount && billToPrint.totalDiscount > 0) {
    content += `<tr><td class="text-right" style="color: #059669;">Discount:</td><td class="text-right font-medium" style="color: #059669;">-${currencySymbol}${billToPrint.totalDiscount.toFixed(2)}</td></tr>`;
  }

  if (showTaxDetailsInItems) {
    if (billToPrint.taxType === 'inter-state') {
      content += `<tr><td class="text-right">Total IGST:</td><td class="text-right font-medium">${currencySymbol}${(billToPrint.totalIGST || 0).toFixed(2)}</td></tr>`;
    } else {
      content += `<tr><td class="text-right">Total SGST:</td><td class="text-right font-medium">${currencySymbol}${(billToPrint.totalSGST || 0).toFixed(2)}</td></tr>`;
      content += `<tr><td class="text-right">Total CGST:</td><td class="text-right font-medium">${currencySymbol}${(billToPrint.totalCGST || 0).toFixed(2)}</td></tr>`;
    }
  }

  content += `<tr><td colspan="2"><div class="final-total text-right">Grand Total: ${currencySymbol}${billToPrint.totalAmount.toFixed(2)}</div></td></tr>`;
  if (billToPrint.type === 'return' && (billToPrint.refundAmount ?? 0) > 0) {
    content += `<tr><td colspan="2" class="text-right" style="color: #dc2626; font-weight: 600;">Amount Credited (Refund): -${currencySymbol}${billToPrint.refundAmount?.toFixed(2)}</td></tr>`;
  }
  if (billToPrint.type === 'sell' && !billToPrint.isEstimate && (billToPrint.refundedAmount || 0) > 0) {
    content += `<tr><td colspan="2" class="text-right" style="color: #dc2626; font-weight: 600;">Less: Returned / Credited: -${currencySymbol}${(billToPrint.refundedAmount || 0).toFixed(2)}</td></tr>`;
    content += `<tr><td colspan="2" class="text-right" style="font-weight: 700;">Net Amount Settled: ${currencySymbol}${((billToPrint.totalAmount || 0) - (billToPrint.refundedAmount || 0)).toFixed(2)}</td></tr>`;
  }
  content += '</table>';
  content += '</div>';

  // Notes
  if (billToPrint.notes) {
    content += '<div class="notes-section">';
    content += '<strong>Notes:</strong> ' + billToPrint.notes;
    content += '</div>';
  }

  // Footer
  content += '<div class="footer">';
  content += '<p>Thank you for your business!</p>';
  content += '<p>This is a computer generated invoice and does not require a signature.</p>';
  content += '</div>';

  content += '</div></body></html>';
  return content;
};

const HR = '----------------------------------------';
const HR_DOUBLE = '========================================';

const generateBillPrintContentThermal = (
  billToPrint: Bill,
  userProfile: UserProfile | undefined,
  products: Product[],
  paperWidth: 'thermal-80mm' | 'thermal-58mm'
): string => {
  const currencySymbol = getCurrencySymbol(userProfile?.companyCurrency);
  const narrow = paperWidth === 'thermal-58mm';
  const fontSize = narrow ? '10px' : '11px';
  const containerStyle = narrow ? 'width: 48mm; padding: 2mm;' : 'width: 72mm; padding: 3mm;';

  let r = '';
  r += `<html><head><title>Receipt</title><style>`;
  r += `* { margin: 0; padding: 0; box-sizing: border-box; }`;
  r += `body { font-family: 'Courier New', Courier, monospace; font-size: ${fontSize}; line-height: 1.3; color: #000; }`;
  r += `.receipt { ${containerStyle} }`;
  r += `.c { text-align: center; }`;
  r += `.r { text-align: right; }`;
  r += `.b { font-weight: bold; }`;
  r += `hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }`;
  r += `.item-row { margin-bottom: 1mm; }`;
  r += `.item-line { display: flex; justify-content: space-between; }`;
  r += `.item-detail { font-size: ${narrow ? '9px' : '10px'}; color: #444; }`;
  r += `.total-line { display: flex; justify-content: space-between; font-weight: bold; margin-top: 1mm; }`;
  r += `.grand-total { font-size: ${narrow ? '12px' : '13px'}; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1mm 0; margin-top: 1mm; }`;
  r += `@page { size: ${narrow ? '58mm' : '80mm'} auto; margin: 0; }`;
  r += `@media print { body { -webkit-print-color-adjust: exact; } }`;
  r += `</style></head><body><div class="receipt">`;

  // Header
  r += `<div class="c b" style="font-size: ${narrow ? '11px' : '13px'};">${userProfile?.companyName || 'Bill'}</div>`;
  if (userProfile?.companyAddress) r += `<div class="c" style="font-size: 9px;">${userProfile.companyAddress}</div>`;
  if (userProfile?.companyPhone) r += `<div class="c" style="font-size: 9px;">Ph: ${userProfile.companyPhone}</div>`;
  if (userProfile?.companyGstNo) r += `<div class="c" style="font-size: 9px;">GSTIN: ${userProfile.companyGstNo}</div>`;
  r += `<hr>`;

  // Bill type
  const billTitle = billToPrint.type === 'buy' ? 'PURCHASE BILL' :
    billToPrint.type === 'sell' && billToPrint.isEstimate ? 'ESTIMATE' :
    billToPrint.type === 'sell' ? 'SALES BILL' :
    billToPrint.type === 'return' && billToPrint.returnType === 'exchange' ? 'EXCHANGE' :
    billToPrint.type === 'return' ? 'RETURN' : 'BILL';
  r += `<div class="c b">${billTitle}</div>`;

  // Invoice info
  r += `<div style="display:flex; justify-content:space-between; font-size: 9px; margin-top: 1mm;">`;
  r += `<span>${billToPrint.invoiceNumber || billToPrint.id.slice(-8).toUpperCase()}</span>`;
  r += `<span>${format(new Date(billToPrint.date), 'dd/MM/yy pp')}</span>`;
  r += `</div>`;
  if (billToPrint.type === 'return' && billToPrint.originalBillId) {
    r += `<div style="font-size: 9px; margin-top: 1mm;">AGAINST: ${billToPrint.originalBillId}</div>`;
  }
  if (billToPrint.vendorOrCustomerName) {
    r += `<div style="font-size: 9px; margin-top: 1mm;"><span class="b">${billToPrint.vendorOrCustomerName}</span></div>`;
  }
  if (billToPrint.customerPhone) {
    r += `<div style="font-size: 9px;">${billToPrint.customerPhone}</div>`;
  }
  if (billToPrint.paymentStatus && !billToPrint.isEstimate) {
    const ps = billToPrint.paymentStatus.toUpperCase();
    r += `<div style="font-size: 9px; margin-top: 1mm;" class="b">${ps}</div>`;
  }
  r += `<hr>`;

  // Items
  const showTax = billToPrint.type === 'sell' && !billToPrint.isEstimate && billToPrint.taxType;
  billToPrint.items.forEach((item) => {
    const price = billToPrint.type === 'buy' ? item.costPrice : item.sellPrice;
    const lineTotal = price * item.quantity;
    r += `<div class="item-row">`;
    r += `<div class="item-line"><span class="b">${item.productName}</span></div>`;
    r += `<div class="item-line item-detail"><span>  ${item.quantity} x ${currencySymbol}${price.toFixed(2)}</span><span>${currencySymbol}${lineTotal.toFixed(2)}</span></div>`;
    if (item.discountAmount && item.discountAmount > 0) {
      r += `<div class="item-line item-detail"><span>  Disc</span><span>-${currencySymbol}${item.discountAmount.toFixed(2)}</span></div>`;
    }
    if (showTax && !item.isAdditionalCharge) {
      if (billToPrint.taxType === 'inter-state' && item.igstAmount) {
        r += `<div class="item-line item-detail"><span>  IGST</span><span>${currencySymbol}${item.igstAmount.toFixed(2)}</span></div>`;
      } else {
        if (item.sgstAmount) r += `<div class="item-line item-detail"><span>  SGST</span><span>${currencySymbol}${item.sgstAmount.toFixed(2)}</span></div>`;
        if (item.cgstAmount) r += `<div class="item-line item-detail"><span>  CGST</span><span>${currencySymbol}${item.cgstAmount.toFixed(2)}</span></div>`;
      }
    }
    r += `</div>`;
  });

  r += `<hr>`;

  // Totals
  r += `<div class="item-line"><span>Subtotal</span><span>${currencySymbol}${(billToPrint.subTotal || 0).toFixed(2)}</span></div>`;
  if (billToPrint.totalDiscount && billToPrint.totalDiscount > 0) {
    r += `<div class="item-line" style="color:#059669;"><span>Discount</span><span>-${currencySymbol}${billToPrint.totalDiscount.toFixed(2)}</span></div>`;
  }
  if (showTax) {
    if (billToPrint.taxType === 'inter-state') {
      if (billToPrint.totalIGST) r += `<div class="item-line"><span>IGST</span><span>${currencySymbol}${billToPrint.totalIGST.toFixed(2)}</span></div>`;
    } else {
      if (billToPrint.totalSGST) r += `<div class="item-line"><span>SGST</span><span>${currencySymbol}${billToPrint.totalSGST.toFixed(2)}</span></div>`;
      if (billToPrint.totalCGST) r += `<div class="item-line"><span>CGST</span><span>${currencySymbol}${billToPrint.totalCGST.toFixed(2)}</span></div>`;
    }
  }
  r += `<div class="total-line grand-total"><span>TOTAL</span><span>${currencySymbol}${billToPrint.totalAmount.toFixed(2)}</span></div>`;
  if (billToPrint.type === 'return' && (billToPrint.refundAmount ?? 0) > 0) {
    r += `<div class="item-line" style="color:#dc2626; font-weight:bold;"><span>REFUND</span><span>-${currencySymbol}${billToPrint.refundAmount?.toFixed(2)}</span></div>`;
  }
  if (billToPrint.type === 'sell' && !billToPrint.isEstimate && (billToPrint.refundedAmount || 0) > 0) {
    r += `<div class="item-line" style="color:#dc2626;"><span>RETURNED</span><span>-${currencySymbol}${(billToPrint.refundedAmount || 0).toFixed(2)}</span></div>`;
    r += `<div class="total-line grand-total"><span>NET</span><span>${currencySymbol}${((billToPrint.totalAmount || 0) - (billToPrint.refundedAmount || 0)).toFixed(2)}</span></div>`;
  }

  // Footer
  r += `<hr>`;
  if (billToPrint.notes) {
    r += `<div class="c" style="font-size: 9px; margin-top: 1mm;">${billToPrint.notes}</div>`;
  }
  r += `<div class="c" style="font-size: 8px; margin-top: 2mm;">Thank you!</div>`;

  r += `</div></body></html>`;
  return r;
};

export const generateReportPrintContent = (
  reportHtml: string,
  reportTitle: string,
  userProfile: UserProfile | undefined
): string => {
  let content = '<html><head><title>Print Report - ' + reportTitle + '</title>';
  const styles =
    "<style>\n" +
    "  body { font-family: Arial, Helvetica, sans-serif; margin: 20px; line-height: 1.4; color: #333; font-size: 10pt; }\n" +
    "  @page { size: auto; margin: 0.5in; }\n" +
    "  .print-container { max-width: 800px; margin: auto; }\n" +
    "  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 25px; }\n" +
    "  .header h1 { margin: 0 0 5px 0; font-size: 18pt; font-weight: bold; color: #000; }\n" +
    "  .header p { margin: 2px 0; font-size: 9pt; color: #444; }\n" +
    "  h3 { font-size: 14pt; margin-bottom: 15px; text-align: center; }\n" +
    "  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }\n" +
    "  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }\n" +
    "  th { background-color: #f7f7f7; font-weight: bold; color: #222; }\n" +
    "  .card { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 15px; page-break-inside: avoid; }\n" +
    "  .card-header { padding: 15px; border-bottom: 1px solid #eee; }\n" +
    "  .card-title { font-size: 14pt; margin: 0; font-weight: bold; }\n" +
    "  .card-description { font-size: 9pt; color: #555; margin: 4px 0 0 0; }\n" +
    "  .card-content { padding: 15px; }\n" +
    "  .card-footer { padding: 15px; border-top: 1px solid #eee; background-color: #f9f9f9; font-size: 8pt; }\n" +
    "  .text-right { text-align: right; }\n" +
    "  .text-destructive { color: #dc2626 !important; } \n" +
    "  .text-green-600 { color: #16a34a !important; } \n" +
    "  .flex { display: flex !important; } .justify-between { justify-content: space-between !important; } .items-center { align-items: center !important; } \n" +
    "  .font-bold { font-weight: bold; } .font-semibold { font-weight: 600; } \n" +
    "  .text-muted-foreground { color: #555; } \n" +
    "  .no-print { display: none !important; } \n" +
    "</style>\n";
  content += styles;
  content += '</head><body>';
  content += '<div class="print-container">';

  content += '<div class="header">';
  content += `<h1>${userProfile?.companyName || DEFAULT_COMPANY_NAME}</h1>`;
  content += `<p>${userProfile?.companyAddress || COMPANY_ADDRESS}</p>`;
  content += `<p>Date Generated: ${format(new Date(), 'PPpp')}</p>`;
  content += '</div>';

  content += `<h3>${reportTitle}</h3>`;
  content += reportHtml;

  content += '</div></body></html>';
  return content;
};


const openBrowserPrintWindow = (content: string) => {
  const printWindow = window.open('', '', 'width=1200,height=800,menubar=no,toolbar=no');
  if (printWindow) {
    const printControls = `
      <div class="no-print" style="position: sticky; top: 0; z-index: 9999; display: flex; justify-content: flex-end; gap: 8px; padding: 10px; background: #ffffff; border-bottom: 1px solid #e5e7eb;">
        <button onclick="window.print()" style="height: 36px; padding: 0 14px; border: 0; border-radius: 6px; background: #16a34a; color: #ffffff; font: 600 13px Arial, sans-serif; cursor: pointer;">Print</button>
      </div>
    `;
    const printScript = `
      <script>
        (function () {
          function printWhenReady() {
            if (window.__ecbillsPrintStarted) return;
            window.__ecbillsPrintStarted = true;
            setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          }

          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            printWhenReady();
          } else {
            window.addEventListener('load', printWhenReady, { once: true });
          }
        })();
      </script>
    `;
    const printStyles = `
      <style>
        @media print {
          .no-print { display: none !important; }
        }
      </style>
    `;
    const contentWithControls = content.includes('<body>')
      ? content.replace('<body>', `<body>${printControls}`)
      : `${printControls}${content}`;
    const contentWithStyles = contentWithControls.includes('</head>')
      ? contentWithControls.replace('</head>', `${printStyles}</head>`)
      : `${printStyles}${contentWithControls}`;
    const printableContent = contentWithStyles.includes('</body>')
      ? contentWithStyles.replace('</body>', `${printScript}</body>`)
      : `${contentWithStyles}${printScript}`;

    printWindow.document.open();
    printWindow.document.write(printableContent);
    printWindow.document.close();
  } else {
    alert("Please allow popups to print the bill.");
  }
};

export const triggerPrint = (content: string) => {
  const selectedPrinter =
    typeof window !== 'undefined' ? localStorage.getItem(SELECTED_PRINTER_STORAGE_KEY) || undefined : undefined;

  if (window.ecbillsPrinter) {
    window.ecbillsPrinter
      .printHtml(content, selectedPrinter)
      .then((result) => {
        if (!result.success) {
          console.warn('[ecbills.in] Desktop print failed, opening browser print window:', result.error);
          openBrowserPrintWindow(content);
        }
      })
      .catch((error) => {
        console.warn('[ecbills.in] Desktop print failed, opening browser print window:', error);
        openBrowserPrintWindow(content);
      });
    return;
  }

  openBrowserPrintWindow(content);
};

export const generatePrintContent = (
  bill: Bill,
  userProfile: UserProfile | undefined,
  products: Product[]
): string => {
  const format = getPaperFormat();
  if (format === 'thermal-80mm' || format === 'thermal-58mm') {
    return generateBillPrintContentThermal(bill, userProfile, products, format);
  }
  return generateBillPrintContent(bill, userProfile, products);
};
