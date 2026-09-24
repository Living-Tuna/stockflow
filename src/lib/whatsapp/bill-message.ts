// Builds a plain-text WhatsApp-friendly invoice from a Bill + company profile.
import type { Bill, Company } from '@/types';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/utils';

const LINE = '----------------------------------------';

function money(n: number | undefined, symbol: string): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return `${symbol}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildBillWhatsappMessage(bill: Bill, company: Company): string {
  const symbol = getCurrencySymbol(company.currency);
  const title =
    bill.type === 'sell' && bill.isEstimate
      ? 'ESTIMATE / QUOTATION'
      : bill.type === 'sell'
      ? 'TAX INVOICE'
      : bill.type === 'buy'
      ? 'PURCHASE BILL'
      : 'RETURN / CREDIT NOTE';

  const lines: string[] = [];
  lines.push(`*${company.name || 'Invoice'}*`);
  if (company.phone) lines.push(`Tel: ${company.phone}`);
  if (company.address) lines.push(company.address);
  if (company.gstNo) lines.push(`GSTIN: ${company.gstNo}`);
  lines.push(LINE);
  lines.push(`*${title}*`);
  lines.push(`Invoice No: ${bill.invoiceNumber || bill.id.substring(0, 8).toUpperCase()}`);
  lines.push(`Date: ${format(new Date(bill.date), 'dd-MMM-yyyy, hh:mm a')}`);
  if (bill.vendorOrCustomerName) lines.push(`Party: ${bill.vendorOrCustomerName}`);
  if (bill.customerPhone) lines.push(`Phone: ${bill.customerPhone}`);
  if (bill.gstin) lines.push(`Party GSTIN: ${bill.gstin}`);
  if (bill.type === 'return') {
    if (bill.originalBillId) lines.push(`Against Bill: ${bill.originalBillId.substring(0, 8).toUpperCase()}`);
    if (bill.returnType === 'exchange') lines.push(`Type: Exchange (like-for-like, no refund)`);
  }
  lines.push(LINE);

  lines.push(`# Item`);
  lines.push(`   Qty     Rate              Amount`);
  let row = 0;
  for (const item of bill.items) {
    row += 1;
    const qty = item.quantity ?? 0;
    const price = bill.type === 'buy' ? item.costPrice : item.sellPrice;
    const amount = qty * (price || 0);
    const label = item.productName || 'Item';
    lines.push(`${row}. ${label}`);
    if (item.selectedVariantOptions && Object.keys(item.selectedVariantOptions).length > 0) {
      const opts = Object.entries(item.selectedVariantOptions).map(([k, v]) => `${k}: ${v}`).join(', ');
      lines.push(`   [${opts}]`);
    }
    lines.push(`   ${qty}   x ${money(price, symbol).padStart(8)}  = ${money(amount, symbol)}`);
  }
  lines.push(LINE);
  if (bill.subTotal !== undefined) lines.push(`Sub Total:    ${money(bill.subTotal, symbol)}`);
  if (!bill.isEstimate) {
    if (bill.totalSGST || bill.totalCGST || bill.totalIGST) {
      if (bill.taxType === 'inter-state') {
        lines.push(`IGST: ${money(bill.totalIGST, symbol)}`);
      } else {
        lines.push(`SGST: ${money(bill.totalSGST, symbol)}`);
        lines.push(`CGST: ${money(bill.totalCGST, symbol)}`);
      }
    }
    if (bill.totalDiscount) lines.push(`Discount:     ${money(bill.totalDiscount, symbol)}`);
  }
  lines.push(`*TOTAL: ${money(bill.totalAmount, symbol)}*`);
  if (bill.paymentStatus && !bill.isEstimate) {
    lines.push(`Status: ${bill.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}`);
  }
  if (bill.notes) {
    lines.push(LINE);
    lines.push(bill.notes);
  }
  if (company.slogan) {
    lines.push(LINE);
    lines.push(company.slogan);
  }
  lines.push('\nThank you for your business! 💚');
  return lines.join('\n');
}

/** Picks the best company record for message footer (falls back gracefully). */
export function billsContactName(bill: Bill): string | undefined {
  return bill.vendorOrCustomerName || undefined;
}