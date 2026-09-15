"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { cn, getCurrencySymbol } from '@/lib/utils';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { ManualEntry, ManualEntryType } from '@/types';
import { LogoSpinner } from '@/components/common/logo-spinner';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Coins,
  Pencil,
  Plus,
  Sunrise,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

interface DailyLedgerProps {
  startDate?: Date;
  endDate?: Date;
  storeId?: string;
}

const INCOME_CATEGORIES = ['Owner Capital Input', 'Other Income', 'Rent Received', 'Interest', 'Commission', 'Misc Income'];
const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Electricity', 'Internet', 'Transport', 'Maintenance', 'Misc Expense', 'Other Expense'];

type EntryTypeToggle = Exclude<ManualEntryType, 'opening_balance'>;

interface StatTileProps {
  label: string;
  value: number;
  currencySymbol: string;
  tone: 'amber' | 'green' | 'red' | 'blue';
  large?: boolean;
}

function StatTile({ label, value, currencySymbol, tone, large }: StatTileProps) {
  const toneClasses = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
  }[tone];

  return (
    <div className={cn('rounded-lg p-4 border shadow-sm', toneClasses, large && 'sm:col-span-2')}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className={cn('mt-1 font-bold tabular-nums', large ? 'text-2xl' : 'text-lg')}>
        {currencySymbol}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export function DailyLedger({ startDate, endDate, storeId }: DailyLedgerProps) {
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();
  const {
    manualEntries,
    addManualEntry,
    updateManualEntry,
    deleteManualEntry,
    getDailyLedger,
    userProfile,
  } = useInventoryStore(state => ({
    manualEntries: state.manualEntries,
    addManualEntry: state.addManualEntry,
    updateManualEntry: state.updateManualEntry,
    deleteManualEntry: state.deleteManualEntry,
    getDailyLedger: state.getDailyLedger,
    userProfile: state.userProfile,
  }));

  const companyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') || undefined : undefined;
  const currencySymbol = getCurrencySymbol(userProfile.companyCurrency);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const from = startDate && !isNaN(startDate.getTime()) ? startDate : new Date();
    return startOfDay(from);
  });

  const [entryType, setEntryType] = useState<EntryTypeToggle>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [showOpeningSetter, setShowOpeningSetter] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [isSavingOpening, setIsSavingOpening] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (companyId) ensureLoaded(['manualEntries', 'bills']);
  }, [companyId, ensureLoaded]);

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const effectiveStoreId = storeId === 'all' ? undefined : storeId;

  const ledger = useMemo(
    () => getDailyLedger(selectedDate, companyId, effectiveStoreId),
    [selectedDate, companyId, effectiveStoreId, getDailyLedger, manualEntries]
  );

  const dayEntries = useMemo(
    () => manualEntries
      .filter(e => e.companyId === companyId && e.date === dateKey && (!effectiveStoreId || e.storeId === effectiveStoreId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [manualEntries, companyId, dateKey, effectiveStoreId]
  );

  const openingEntry = useMemo(() => dayEntries.find(e => e.entryType === 'opening_balance'), [dayEntries]);

  const manualIncome = useMemo(
    () => dayEntries.filter(e => e.entryType === 'income').reduce((sum, e) => sum + e.amount, 0),
    [dayEntries]
  );
  const manualExpense = useMemo(
    () => dayEntries.filter(e => e.entryType === 'expense').reduce((sum, e) => sum + e.amount, 0),
    [dayEntries]
  );

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a valid amount greater than zero.' });
      return;
    }
    setIsSaving(true);
    const created = await addManualEntry(
      {
        date: dateKey,
        entryType,
        amount: parsedAmount,
        category: category.trim() || (entryType === 'income' ? 'Other Income' : 'Other Expense'),
        note: note.trim() || undefined,
        storeId: effectiveStoreId || null,
      },
      companyId || ''
    );
    setIsSaving(false);
    if (created) {
      toast({ title: 'Entry Added', description: `${created.category || 'Entry'} of ${currencySymbol}${created.amount.toFixed(2)} recorded.` });
      setAmount('');
      setCategory('');
      setNote('');
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not add the entry. Please try again.' });
    }
  };

  const handleSetOpening = async () => {
    const parsedAmount = Number(openingAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a valid opening balance.' });
      return;
    }
    setIsSavingOpening(true);
    const created = await addManualEntry(
      {
        date: dateKey,
        entryType: 'opening_balance',
        amount: parsedAmount,
        category: 'Opening Balance',
        storeId: effectiveStoreId || null,
      },
      companyId || ''
    );
    setIsSavingOpening(false);
    if (created) {
      toast({ title: 'Opening Balance Set', description: `Opening balance for ${dateKey} set to ${currencySymbol}${parsedAmount.toFixed(2)}.` });
      setOpeningAmount('');
      setShowOpeningSetter(false);
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not save the opening balance.' });
    }
  };

  const handleClearOpening = async () => {
    if (!openingEntry) return;
    const ok = await deleteManualEntry(openingEntry.id, companyId || '');
    if (ok) {
      toast({ title: 'Opening Balance Cleared', description: 'Reverted to auto carry-forward from previous day.' });
    }
  };

  const startEditing = (entry: ManualEntry) => {
    setEditingId(entry.id);
    setEditAmount(String(entry.amount));
    setEditCategory(entry.category || '');
    setEditNote(entry.note || '');
  };

  const saveEditing = async (entry: ManualEntry) => {
    const parsedAmount = Number(editAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a valid amount.' });
      return;
    }
    setIsSavingEdit(true);
    const updated = await updateManualEntry(
      entry.id,
      {
        amount: parsedAmount,
        category: editCategory.trim() || entry.category,
        note: editNote.trim() || undefined,
      },
      companyId || ''
    );
    setIsSavingEdit(false);
    if (updated) {
      toast({ title: 'Entry Updated', description: 'The entry has been updated.' });
      setEditingId(null);
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not update the entry.' });
    }
  };

  const handleDeleteEntry = async (entry: ManualEntry) => {
    const ok = await deleteManualEntry(entry.id, companyId || '');
    if (ok) {
      toast({ title: 'Entry Deleted', description: 'The entry has been removed.' });
    }
  };

  const categories = entryType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const entryBadge = (type: ManualEntryType) => {
    if (type === 'opening_balance') return <Badge className="bg-amber-100 text-amber-800">Opening</Badge>;
    if (type === 'income') return <Badge className="bg-green-100 text-green-800">Income</Badge>;
    return <Badge className="bg-red-100 text-red-800">Expense</Badge>;
  };

  const entryAmount = (type: ManualEntryType, value: number) => {
    if (type === 'opening_balance') return `${currencySymbol}${value.toFixed(2)}`;
    if (type === 'income') return `+${currencySymbol}${value.toFixed(2)}`;
    return `-${currencySymbol}${value.toFixed(2)}`;
  };

  if (!ledger) {
    return (
      <Card className="shadow-lg border-t-2 border-t-primary w-full max-w-5xl mx-auto">
        <CardContent className="flex items-center justify-center p-12">
          <LogoSpinner size={24} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-t-2 border-t-primary w-full max-w-5xl mx-auto">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sunrise className="h-5 w-5 text-primary" />
              Daily Cash Ledger
            </CardTitle>
            <CardDescription>
              Opening balance, sales, income, expenses and closing balance for the selected day.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => addDays(d, -1))} title="Previous day">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 justify-start gap-2 min-w-[150px]">
                  <CalendarDays className="h-4 w-4" />
                  {format(selectedDate, 'EEE, LLL dd, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(startOfDay(d))} initialFocus />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => addDays(d, 1))} title="Next day">
              <ArrowRight className="h-4 w-4" />
            </Button>
            {dateKey !== todayKey && (
              <Button variant="ghost" className="h-9" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Opening Balance" value={ledger.openingBalance} currencySymbol={currencySymbol} tone="amber" />
          <StatTile label="Today's Sales" value={ledger.sales} currencySymbol={currencySymbol} tone="green" />
          <StatTile label="Additional Income" value={ledger.otherIncome} currencySymbol={currencySymbol} tone="green" />
          <StatTile label="Total Income" value={ledger.totalIncome} currencySymbol={currencySymbol} tone="blue" />
          <StatTile label="Purchase Expenses" value={ledger.purchaseExpenses} currencySymbol={currencySymbol} tone="red" />
          <StatTile label="Additional Expenses" value={ledger.otherExpenses} currencySymbol={currencySymbol} tone="red" />
          <StatTile label="Total Expenses" value={ledger.totalExpenses} currencySymbol={currencySymbol} tone="red" />
          <StatTile label="Closing Balance" value={ledger.closingBalance} currencySymbol={currencySymbol} tone="blue" large />
        </div>
        <p className="text-xs text-muted-foreground">
          Opening balance auto-carries from the previous day&apos;s closing. Sales/cash in = paid sales bills; purchases/cash out = paid purchase bills.
          Additional income &amp; expenses are manual company entries you add below.
        </p>

        <Separator />

        {/* Opening balance setter */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold">Opening Balance</h3>
              {ledger.hasOpeningOverride && <Badge variant="outline">Manual set</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {openingEntry ? (
                <Button variant="outline" size="sm" onClick={handleClearOpening}>
                  <X className="mr-1 h-3 w-3" /> Clear Manual
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowOpeningSetter(s => !s)}>
                  <Coins className="mr-1 h-3 w-3" /> Set Opening Balance
                </Button>
              )}
            </div>
          </div>
          {showOpeningSetter && !openingEntry && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 bg-muted/40">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Opening balance (${currencySymbol})`}
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-48"
              />
              <Button size="sm" onClick={handleSetOpening} disabled={isSavingOpening}>
                {isSavingOpening && <LogoSpinner size={12} className="mr-1" alt="" />}
                Save as opening
              </Button>
            </div>
          )}
        </div>

        {/* Add additional income / expense */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Add Additional Income / Expense</h3>
          </div>
          <form onSubmit={handleAddEntry} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40 lg:col-span-1">
              <button
                type="button"
                onClick={() => setEntryType('income')}
                className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center justify-center gap-1',
                  entryType === 'income' ? 'bg-green-600 text-white' : 'text-muted-foreground hover:text-foreground')}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Income
              </button>
              <button
                type="button"
                onClick={() => setEntryType('expense')}
                className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center justify-center gap-1',
                  entryType === 'expense' ? 'bg-red-600 text-white' : 'text-muted-foreground hover:text-foreground')}
              >
                <TrendingDown className="h-3.5 w-3.5" /> Expense
              </button>
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input list="ledger-categories" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="ledger-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" disabled={isSaving} className="lg:col-span-1">
              {isSaving && <LogoSpinner size={16} className="mr-1" alt="" />}
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>
        </div>

        {/* Entries for the day */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Entries for {format(selectedDate, 'LLL dd, yyyy')}</h3>
            <Badge variant="secondary">{dayEntries.length}</Badge>
          </div>
          {dayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No manual entries for this day. Use the form above to add income or expenses.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden bg-tertiary">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-52">Category</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-36 text-right">Amount</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayEntries.map(entry => (
                    <TableRow key={entry.id}>
                      {editingId === entry.id ? (
                        <>
                          <TableCell>{entryBadge(entry.entryType)}</TableCell>
                          <TableCell>
                            <Input
                              list="ledger-categories"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="h-8 w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="h-8 w-full"
                              placeholder="Note"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-8 w-32 ml-auto text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" onClick={() => saveEditing(entry)} disabled={isSavingEdit} title="Save">
                                {isSavingEdit && <LogoSpinner size={12} className="mr-1" alt="" />}
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{entryBadge(entry.entryType)}</TableCell>
                          <TableCell className="font-medium">{entry.category || (entry.entryType === 'income' ? 'Income' : 'Expense')}</TableCell>
                          <TableCell className="text-muted-foreground">{entry.note || <span className="text-muted-foreground/50">—</span>}</TableCell>
                          <TableCell className={cn(
                            'text-right font-semibold tabular-nums',
                            entry.entryType === 'income' ? 'text-green-600' : entry.entryType === 'expense' ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {entryAmount(entry.entryType, entry.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(entry)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteEntry(entry)} title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm font-semibold">Day manual subtotal</TableCell>
                    <TableCell colSpan={2} className="text-right text-sm font-semibold tabular-nums">
                      <span className="text-green-600">
                        +{currencySymbol}{manualIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-red-600">
                        −{currencySymbol}{manualExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}