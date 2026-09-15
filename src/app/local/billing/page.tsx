
"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; 
import type { BillMode, Store } from '@/types';
import { PageTitle } from '@/components/common/page-title';
import { BillingForm } from '@/components/billing/billing-form';
import { BillHistoryTable, type TimePeriodFilterOption } from '@/components/history/bill-history-table'; 
import { InventoryLedgerTable } from '@/components/billing/inventory-ledger-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, History as HistoryIcon, ShoppingBag, Send, RotateCcw, ListChecks, BarChart2, CalendarDays, Loader2 } from 'lucide-react';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { DateRange } from "react-day-picker";

type BillingView = 'history' | 'ledger' | 'new';

function BillingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const action = searchParams.get('action');
  const modeFromUrl = searchParams.get('mode') as BillMode | null;
  const currentViewFromUrl = searchParams.get('view') as BillingView | null;

  const { 
    stores: storesFromZustand, 
    companyId: currentCompanyIdFromStore, 
  } = useInventoryStore(state => ({
    stores: state.stores, 
    companyId: localStorage.getItem('companyId') 
  }));

  const { ensureLoaded } = useAppData();

  const [allStoresState, setAllStoresState] = useState<Store[]>([]);
  const [activeBillingView, setActiveBillingView] = useState<BillingView>(currentViewFromUrl || 'history');
  const [hasMounted, setHasMounted] = useState(false);
  
  // Local mode does NOT have admin context - it's restricted to local store only
  const isAdminContext = false; 

  const [timePeriodFilter, setTimePeriodFilter] = useState<TimePeriodFilterOption>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    setHasMounted(true);
    if (currentCompanyIdFromStore) {
      ensureLoaded(['bills', 'stores']);
    }
  }, [currentCompanyIdFromStore, ensureLoaded]); 

  useEffect(() => {
    if (hasMounted) {
      setAllStoresState(storesFromZustand); 
      setActiveBillingView(currentViewFromUrl || 'history');
    }
  }, [hasMounted, storesFromZustand, currentViewFromUrl]); 

  const handleViewToggle = (view: BillingView) => {
    setActiveBillingView(view);
    const newParams = new URLSearchParams(searchParams.toString());
    if (view === 'history' || view === 'ledger') {
      newParams.set('view', view);
      newParams.delete('action'); newParams.delete('mode'); newParams.delete('storeId');
    }
    router.push(`${pathname}?${newParams.toString()}`);
  };

  const handleTimePeriodChange = (period: TimePeriodFilterOption) => {
    setTimePeriodFilter(period);
    if (period !== 'custom') {
      setCustomDateRange(undefined); 
    }
  };

  const isNewBillAction = action === 'new' || !!modeFromUrl;

  let effectiveModeForTitle: BillMode = 'sell'; 
  if (modeFromUrl && ['sell', 'buy', 'return'].includes(modeFromUrl)) {
    effectiveModeForTitle = modeFromUrl;
  }

  if (isNewBillAction) {
    let title = "New Sales Bill";
    let icon = Send;

    if (effectiveModeForTitle === 'buy') { title = "New Purchase Bill"; icon = ShoppingBag; }
    else if (effectiveModeForTitle === 'return') { title = "New Return Entry"; icon = RotateCcw; }
    
    // In local mode, we assume a store is created. If not, the form will complain, but Layout should ensure it.
    
    const newBillPageTitleActions = (
        <>
            <Button variant="outline" onClick={() => handleViewToggle('history')} className="w-full md:w-auto">
              <HistoryIcon className="mr-2 h-4 w-4" /> Bill History
            </Button>
            <Button variant="outline" onClick={() => handleViewToggle('ledger')} className="w-full md:w-auto">
              <ListChecks className="mr-2 h-4 w-4" /> Inventory Ledger
            </Button>
        </>
    );

    return (
      <>
        <PageTitle title={title} icon={icon} actions={newBillPageTitleActions} />
        <BillingForm
          key={`new-bill-form-${effectiveModeForTitle}`} 
          initialModeProp={effectiveModeForTitle}
          isAdminContext={false}
          allowedModes={['sell']}
          redirectBasePath="/local/billing"
          preselectedStoreId={allStoresState.length > 0 ? allStoresState[0].id : undefined}
        />
      </>
    );
  }

  const newBillHrefPath = `/local/billing?action=new&mode=sell`;
  
  const mainPageActions = (
    <>
      {activeBillingView === 'history' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Select value={timePeriodFilter} onValueChange={(value) => handleTimePeriodChange(value as TimePeriodFilterOption)}>
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-9 select-trigger-class">
                      <SelectValue placeholder="Filter by time" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                      <SelectItem value="thisYear">This Year</SelectItem>
                      <SelectItem value="lastYear">Last Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
              </Select>
              {timePeriodFilter === 'custom' && (
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:min-w-[260px] justify-start text-left font-normal h-9", !customDateRange && "text-muted-foreground" )}>
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {customDateRange?.from ? (
                                  customDateRange.to ? (
                                      <>{format(customDateRange.from, "LLL dd, y")} - {format(customDateRange.to, "LLL dd, y")}</>
                                  ) : ( format(customDateRange.from, "LLL dd, y") )
                              ) : ( <span>Pick a date range</span> )}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                          <Calendar initialFocus mode="range" defaultMonth={customDateRange?.from} selected={customDateRange} onSelect={setCustomDateRange} numberOfMonths={2} />
                      </PopoverContent>
                  </Popover>
              )}
          </div>
      )}
        <Button onClick={() => handleViewToggle(activeBillingView === 'history' ? 'ledger' : 'history')} variant="outline" className="w-full md:w-auto">
            {activeBillingView === 'history' ? <ListChecks className="mr-2 h-4 w-4" /> : <HistoryIcon className="mr-2 h-4 w-4" />}
            {activeBillingView === 'history' ? 'Inventory Ledger' : 'Bill History'}
        </Button>
        <Button asChild className="w-full md:w-auto">
            <Link href={newBillHrefPath}><PlusCircle className="mr-2 h-4 w-4" /> Create New Bill</Link>
        </Button>
    </>
  );

  const pageTitleText = activeBillingView === 'ledger' ? 'Inventory Ledger' : 'Bill History';
  const pageTitleIcon = activeBillingView === 'ledger' ? BarChart2 : HistoryIcon;

  return (
    <>
      <PageTitle title={pageTitleText} icon={pageTitleIcon} actions={mainPageActions} />
      {activeBillingView === 'ledger' ? <InventoryLedgerTable /> : 
        <BillHistoryTable 
            key={`${timePeriodFilter}-${customDateRange?.from?.toISOString()}-${customDateRange?.to?.toISOString()}`}
            timePeriodFilter={timePeriodFilter} 
            customStartDate={customDateRange?.from} 
            customEndDate={customDateRange?.to}
        />
      }
    </>
  );
}

const LoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
    <Loader2 className="h-8 w-8 text-primary animate-spin" />
    <p className="text-muted-foreground">Loading Billing Information...</p>
  </div>
);


export default function LocalBillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<LoadingFallback />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}
