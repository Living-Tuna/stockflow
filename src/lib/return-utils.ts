import type { Bill, BillItem } from '@/types';
import { roundMoney } from '@/lib/units';

/**
 * Shared, pure helpers for return/exchange settlement. Used by both the client
 * store (local mode) and the /api/bills route so the accounting rules can never
 * drift apart. A "return" credits money back to the customer and puts the goods
 * (if non-defective) back into stock; an "exchange" is a like-for-like swap —
 * the goods come back into stock but no money is credited, so the sale amount
 * is left untouched.
 */

const variantKey = (options?: Record<string, string>): string =>
  JSON.stringify(Object.fromEntries(Object.entries(options || {}).sort()));

/** Matches a return bill line to its original sale-bill line (product + variant). */
export const sameItemLine = (a: BillItem, b: BillItem): boolean =>
  a.productId === b.productId && variantKey(a.selectedVariantOptions) === variantKey(b.selectedVariantOptions);

/** Quantity of a sale-bill line that can still be returned/exchanged. */
export function getReturnableQuantity(item: BillItem): number {
  const alreadyProcessed =
    (item.returnedQuantity || 0) +
    (item.defectiveReturnedQuantity || 0) +
    (item.exchangedQuantity || 0);
  return Math.max(0, (item.quantity || 0) - alreadyProcessed);
}

export const isExchangeItem = (item: BillItem): boolean => item.isExchange === true;

/**
 * Refund value = the credited total of every NON-exchange return line:
 * (sell price × qty − discount) + SGST + CGST + IGST. Exchange lines never
 * contribute a refund (no money changes hands).
 */
export function computeReturnRefundAmount(items: BillItem[]): number {
  return roundMoney(
    items.reduce((sum, item) => {
      if (isExchangeItem(item)) return sum;
      const raw = (item.sellPrice || 0) * item.quantity;
      const discount = item.discountAmount || 0;
      const taxable = Math.max(0, raw - discount);
      return sum + taxable + (item.sgstAmount || 0) + (item.cgstAmount || 0) + (item.igstAmount || 0);
    }, 0)
  );
}

/** Total taxes (SGST/CGST/IGST) on non-exchange return lines — used to reverse output tax. */
export function sumReturnTaxes(items: BillItem[]): { sgst: number; cgst: number; igst: number; total: number } {
  const out = { sgst: 0, cgst: 0, igst: 0, total: 0 };
  items.forEach((item) => {
    if (isExchangeItem(item)) return;
    out.sgst += item.sgstAmount || 0;
    out.cgst += item.cgstAmount || 0;
    out.igst += item.igstAmount || 0;
  });
  out.sgst = roundMoney(out.sgst);
  out.cgst = roundMoney(out.cgst);
  out.igst = roundMoney(out.igst);
  out.total = roundMoney(out.sgst + out.cgst + out.igst);
  return out;
}

/** Effective/settled amount owed on a sale after accumulated refunds. */
export function getNetBillAmount(bill: Bill): number {
  if (bill.type === 'sell' && !bill.isEstimate && (bill.refundedAmount || 0) > 0) {
    return roundMoney((bill.totalAmount || 0) - (bill.refundedAmount || 0));
  }
  return bill.totalAmount || 0;
}

/** Fraction of a sale that remains settled (1 when nothing was refunded). */
export function getNetAmountRatio(bill: Bill): number {
  const total = bill.totalAmount || 0;
  if (total <= 0) return 0;
  const refunded = bill.refundedAmount || 0;
  return Math.max(0, Math.min(1, (total - refunded) / total));
}

/**
 * Validates a return against the original sale bill. Returns an error message
 * (or null when OK). Every returned quantity must be <= what is still
 * returnable on the matching original line.
 */
export function validateReturnAgainstOriginal(originalBill: Bill, items: BillItem[]): string | null {
  if (!originalBill || originalBill.type !== 'sell' || originalBill.isEstimate) {
    return 'A return must reference a valid sales bill.';
  }
  for (const item of items) {
    if (item.productId.startsWith('SERVICE_ITEM_') || item.productId.startsWith('CHARGE_ITEM_')) continue;
    const originalItem = originalBill.items.find((i) => sameItemLine(i, item));
    if (!originalItem) {
      return `"${item.productName}" is not on the original sales bill (${originalBill.id}).`;
    }
    const remaining = getReturnableQuantity(originalItem);
    if (item.quantity > remaining) {
      return `Only ${remaining} of "${item.productName}" left to return/exchange; ${item.quantity} requested.`;
    }
  }
  return null;
}

/**
 * Returns the original sale bill with its lines annotated and its linkage
 * updated after a return/exchange bill is recorded against it.
 */
export function buildUpdatedOriginalBill(
  originalBill: Bill,
  linkedReturnBillId: string,
  items: BillItem[],
  settledOn: string,
  refundAmount: number
): Bill {
  const updatedItems = originalBill.items.map((originalItem) => {
    const affecting = items.filter((item) => sameItemLine(item, originalItem));
    if (affecting.length === 0) return originalItem;

    let next: BillItem = { ...originalItem };
    for (const r of affecting) {
      const qty = r.quantity || 0;
      if (isExchangeItem(r)) {
        next = {
          ...next,
          exchangedQuantity: (next.exchangedQuantity || 0) + qty,
          lastExchangedOn: settledOn,
        };
      } else if (r.isDefective) {
        next = {
          ...next,
          defectiveReturnedQuantity: (next.defectiveReturnedQuantity || 0) + qty,
          lastReturnedOn: settledOn,
        };
      } else {
        next = {
          ...next,
          returnedQuantity: (next.returnedQuantity || 0) + qty,
          lastReturnedOn: settledOn,
        };
      }
    }
    return next;
  });

  return {
    ...originalBill,
    items: updatedItems,
    refundedAmount: roundMoney((originalBill.refundedAmount || 0) + refundAmount),
    linkedReturnBillIds: [...(originalBill.linkedReturnBillIds || []), linkedReturnBillId],
  };
}