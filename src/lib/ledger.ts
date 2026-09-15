import type { Bill, ManualEntry } from '@/types';

export interface DailyLedger {
  date: string; // YYYY-MM-DD
  openingBalance: number;
  sales: number;
  otherIncome: number;
  totalIncome: number;
  purchaseExpenses: number;
  otherExpenses: number;
  totalExpenses: number;
  closingBalance: number;
  hasOpeningOverride: boolean;
}

export interface LedgerFilters {
  companyId?: string;
  storeId?: string;
}

function toDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

// Cash inflow: paid sales (excluding estimates)
function isCashInflow(b: Bill): boolean {
  return b.type === 'sell' && !b.isEstimate && b.paymentStatus === 'paid';
}

// Cash outflow: paid purchases
function isCashOutflow(b: Bill): boolean {
  return b.type === 'buy' && b.paymentStatus === 'paid';
}

function bump(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) || 0) + amount);
}

/**
 * Computes a daily cash ledger (opening / income / expenses / closing) for every day
 * in [from, to]. Opening for a day defaults to the previous day's closing (auto carry),
 * unless an explicit `opening_balance` manual entry exists for that day.
 *
 * Sales/income = paid sell bills + manual income entries.
 * Expenses     = paid buy bills + manual expense entries.
 */
export function getDailyLedgers(
  bills: Bill[],
  manualEntries: ManualEntry[],
  from: string | Date,
  to: string | Date,
  filters: LedgerFilters = {}
): DailyLedger[] {
  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);
  if (!fromKey || !toKey || fromKey > toKey) return [];

  const { companyId, storeId } = filters;
  const storeMatches = (billStoreId?: string | null) =>
    !storeId || storeId === 'all' || storeId === 'null' || billStoreId === undefined || billStoreId === null || billStoreId === storeId;

  const daySales = new Map<string, number>();
  const dayPurchases = new Map<string, number>();
  const dayIncomes = new Map<string, number>();
  const dayExpenses = new Map<string, number>();
  const openingOverrides = new Map<string, number>();
  let earliest = fromKey;

  const markEarliest = (key: string) => {
    if (key < earliest) earliest = key;
  };

  for (const b of bills) {
    if (companyId && b.companyId !== companyId) continue;
    if (!storeMatches(b.storeId)) continue;
    const key = toDateKey(b.date);
    if (!key) continue;
    if (isCashInflow(b)) {
      bump(daySales, key, b.totalAmount);
      markEarliest(key);
    } else if (isCashOutflow(b)) {
      bump(dayPurchases, key, b.totalAmount);
      markEarliest(key);
    }
  }

  for (const e of manualEntries) {
    if (companyId && e.companyId !== companyId) continue;
    if (!storeMatches(e.storeId)) continue;
    const key = toDateKey(e.date);
    if (!key) continue;
    if (e.entryType === 'income') {
      bump(dayIncomes, key, e.amount);
      markEarliest(key);
    } else if (e.entryType === 'expense') {
      bump(dayExpenses, key, e.amount);
      markEarliest(key);
    } else if (e.entryType === 'opening_balance') {
      bump(openingOverrides, key, e.amount);
      markEarliest(key);
    }
  }

  // If there is data before the requested window, start earlier so running balances carry in correctly.
  const start = earliest < fromKey ? earliest : fromKey;
  const result: DailyLedger[] = [];
  let runningClose = 0;
  let cursor = start;
  const maxIterations = 4000; // safety guard against runaway loops

  for (let i = 0; i < maxIterations; i++) {
    if (cursor > toKey) break;
    const sales = daySales.get(cursor) || 0;
    const purchaseExpenses = dayPurchases.get(cursor) || 0;
    const otherIncome = dayIncomes.get(cursor) || 0;
    const otherExpenses = dayExpenses.get(cursor) || 0;
    const hasOpeningOverride = openingOverrides.has(cursor);
    const openingBalance = hasOpeningOverride ? openingOverrides.get(cursor) || 0 : runningClose;
    const totalIncome = sales + otherIncome;
    const totalExpenses = purchaseExpenses + otherExpenses;
    const closingBalance = openingBalance + totalIncome - totalExpenses;

    if (cursor >= fromKey) {
      result.push({
        date: cursor,
        openingBalance,
        sales,
        otherIncome,
        totalIncome,
        purchaseExpenses,
        otherExpenses,
        totalExpenses,
        closingBalance,
        hasOpeningOverride,
      });
    }
    runningClose = closingBalance;
    cursor = nextDayKey(cursor);
  }

  return result;
}