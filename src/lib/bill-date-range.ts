import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';

export type BillTimePeriod =
  | 'all'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

export interface BillPeriodRange {
  start: Date;
  end: Date;
}

const WEEK_STARTS_ON = 1;

const PERIOD_LABELS: Record<BillTimePeriod, string> = {
  all: 'All Time',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisYear: 'This Year',
  lastYear: 'Last Year',
  custom: 'Custom Range',
};

export const BILL_PERIOD_ORDER: BillTimePeriod[] = [
  'today',
  'thisWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
  'all',
  'custom',
];

export function getBillPeriodRange(
  period: BillTimePeriod,
  customFrom?: Date,
  customTo?: Date,
  now: Date = new Date(),
): BillPeriodRange | null {
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'thisWeek':
      return {
        start: startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }),
      };
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'lastMonth': {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    case 'thisYear':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'lastYear': {
      const last = subYears(now, 1);
      return { start: startOfYear(last), end: endOfYear(last) };
    }
    case 'custom': {
      if (!customFrom || !isValid(customFrom)) return null;
      const start = startOfDay(customFrom);
      const end = customTo && isValid(customTo) ? endOfDay(customTo) : endOfDay(customFrom);
      return end >= start ? { start, end } : null;
    }
    case 'all':
    default:
      return null;
  }
}

export function getBillPeriodOptionLabel(period: BillTimePeriod, now: Date = new Date()): string {
  const base = PERIOD_LABELS[period];
  if (period === 'today' || period === 'all' || period === 'custom') return base;

  const range = getBillPeriodRange(period, undefined, undefined, now);
  if (!range) return base;

  if (period === 'thisWeek') {
    return `${base} · ${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d')}`;
  }
  if (period === 'thisMonth' || period === 'lastMonth') {
    return `${base} · ${format(range.start, 'MMM yyyy')}`;
  }
  return `${base} · ${format(range.start, 'yyyy')}`;
}
