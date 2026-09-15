
"use client";

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; 
import type { BillMode, Store } from '@/types';
import { PageTitle } from '@/components/common/page-title';
import { BillingForm } from '@/components/billing/billing-form';
import { BillHistoryTable, type TimePeriodFilterOption } from '@/components/history/bill-history-table'; 
import { InventoryLedgerTable } from '@/components/billing/inventory-ledger-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, History as HistoryIcon, ShoppingBag, Send, RotateCcw, Building, ListChecks, BarChart2, CalendarDays, Loader2 } from 'lucide-react';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, subMonths, subYears } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StoreFormDialog } from '@/components/stores/store-form-dialog';


type BillingView = 'history' | 'ledger' | 'new';

const HistoryStoreSelector: React.FC<{
  stores: Store[];
  activePlanId?: string;
  currentStoreId?: string;
  onStoreChange: (storeId?: string) => void;
}> = ({ stores, activePlanId, currentStoreId, onStoreChange }) => {
  const isStarterPlan = activePlanId === SUBSCRIPTION_PLAN_IDS.STARTER;

  if ((isStarterPlan && stores.length === 1) || (!isStarterPlan && stores.length ===1)) {
    return (
      <span className="text-sm font-semibold text-primary flex items-center gap-1 p-2 border border-input rounded-md h-9 bg-muted/50 w-full sm:w-auto">
        <Building size={16} />
        {stores[0].name}
      </span>
    );
  }
  
  if (!isStarterPlan && stores.length > 1) {
    return (
      <Select
        key={`store-context-select-history-${activePlanId}-${stores.length}`}
        value={currentStoreId || ""}
        onValueChange={(value) => onStoreChange(value || undefined)}
      >
        <SelectTrigger id="store-context-select-history-trigger" className="w-full sm:w-auto sm:min-w-[180px] h-9 select-trigger-class">
          <SelectValue placeholder="Select Store..." />
        </SelectTrigger>
        <SelectContent position="popper">
          {stores.map(store => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return null;
};


function BillingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const action = searchParams.get('action');
  const modeFromUrl = searchParams.get('mode') as BillMode | null;
  const storeIdFromUrl = searchParams.get('storeId');
  const currentViewFromUrl = searchParams.get('view') as BillingView | null;

  const { 
    getActiveSubscriptionPlan, 
    stores: storesFromZustand, 
    staffs: staffsFromZustand,
    companyId: currentCompanyIdFromStore, 
  } = useInventoryStore(state => ({
    getActiveSubscriptionPlan: state.getActiveSubscriptionPlan,
    stores: state.stores, 
    staffs: state.staffs,
    companyId: localStorage.getItem('companyId') 
  }));

  const { ensureLoaded, refresh } = useAppData();

  const [allStoresState, setAllStoresState] = useState<Store[]>([]);
  const [activePlan, setActivePlan] = useState<ReturnType<typeof getActiveSubscriptionPlan>>(undefined);
  
  const [currentContextStoreId, setCurrentContextStoreId] = useState<string | undefined>(undefined);
  const [selectedStoreForForm, setSelectedStoreForForm] = useState<string | undefined>(undefined);
  const [activeBillingView, setActiveBillingView] = useState<BillingView>(currentViewFromUrl || 'history');

  const [hasMounted, setHasMounted] = useState(false);
  const isAdminContext = true; 

  const [timePeriodFilter, setTimePeriodFilter] = useState<TimePeriodFilterOption>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  const [showNoStoreAlertDialog, setShowNoStoreAlertDialog] = useState(false);
  const [showStoreFormDialog, setShowStoreFormDialog] = useState(false);


  useEffect(() => {
    setHasMounted(true);
    if (currentCompanyIdFromStore) {
      ensureLoaded(['bills', 'stores', 'staff']);
    }
  }, [currentCompanyIdFromStore, ensureLoaded]); 

  useEffect(() => {
    if (hasMounted) {
      setAllStoresState(storesFromZustand); 
      setActivePlan(getActiveSubscriptionPlan());
      setActiveBillingView(currentViewFromUrl || 'history');
    }
  }, [hasMounted, storesFromZustand, getActiveSubscriptionPlan, currentViewFromUrl]); 


  useEffect(() => {
    if (hasMounted && activePlan && allStoresState.length > 0) {
      if (activePlan.id === SUBSCRIPTION_PLAN_IDS.STARTER) {
        setCurrentContextStoreId(allStoresState[0].id);
      } else if (allStoresState.length === 1) {
         setCurrentContextStoreId(allStoresState[0].id);
      } else if (allStoresState.length > 1) {
        const validStoreId = allStoresState.find(s => s.id === storeIdFromUrl) ? storeIdFromUrl : allStoresState[0].id;
        setCurrentContextStoreId(validStoreId);
      }
    } else if (hasMounted && activePlan && allStoresState.length === 0) {
      setCurrentContextStoreId(undefined);
    }
  }, [hasMounted, allStoresState, activePlan, storeIdFromUrl]);

  useEffect(() => {
    if (hasMounted && activePlan && allStoresState.length > 0) {
      const defaultStoreId = allStoresState[0]?.id;
      if (storeIdFromUrl && allStoresState.find(s => s.id === storeIdFromUrl)) {
        setSelectedStoreForForm(storeIdFromUrl);
      } else if (activePlan.id === SUBSCRIPTION_PLAN_IDS.STARTER) {
        setSelectedStoreForForm(defaultStoreId);
      } else {
        setSelectedStoreForForm(allStoresState.length === 1 ? defaultStoreId : (storeIdFromUrl || defaultStoreId));
      }
    } else if (hasMounted && activePlan && allStoresState.length === 0) {
       setSelectedStoreForForm(undefined);
    }
  }, [hasMounted, allStoresState, activePlan, storeIdFromUrl]);

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
  const isStarterPlan = activePlan?.id === SUBSCRIPTION_PLAN_IDS.STARTER;

  let effectiveModeForTitle: BillMode = 'sell'; 
  if (modeFromUrl && ['sell', 'buy', 'return'].includes(modeFromUrl)) {
    effectiveModeForTitle = modeFromUrl;
  }

  if (isNewBillAction) {
    let title = "New Sales Bill";
    let icon = Send;

    if (effectiveModeForTitle === 'buy') { title = "New Purchase Bill"; icon = ShoppingBag; }
    else if (effectiveModeForTitle === 'return') { title = "New Return Entry"; icon = RotateCcw; }

    if (isAdminContext && allStoresState.length === 0 && activePlan && activePlan.maxStores > 0) {
      if (!showNoStoreAlertDialog) {
        setShowNoStoreAlertDialog(true);
      }
      return (
        <>
          <AlertDialog open={showNoStoreAlertDialog} onOpenChange={setShowNoStoreAlertDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>No Store Found</AlertDialogTitle>
                <AlertDialogDescription>
                  You don&apos;t have a store set up yet. Would you like to add one now?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => router.push('/admin/billing')}>No</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setShowNoStoreAlertDialog(false); setShowStoreFormDialog(true); }}>Yes</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <StoreFormDialog 
            isOpen={showStoreFormDialog} 
            onOpenChange={setShowStoreFormDialog} 
            onFormSubmit={() => { refresh(["stores"]); }} 
            allStaff={staffsFromZustand} 
          />
        </>
      );
    }
    
    const newBillPageTitleActions = (
        <>
            {(hasMounted && isAdminContext && ((!isStarterPlan && allStoresState.length > 1) || ((isStarterPlan || allStoresState.length === 1) && allStoresState.length > 0))) && (
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                    <span className="text-sm font-medium whitespace-nowrap text-muted-foreground shrink-0">Billing For Store:</span>
                    {hasMounted && isAdminContext && !isStarterPlan && allStoresState.length > 1 && (
                        <Select
                            key={`store-select-new-bill-${activePlan?.id}-${allStoresState.length}-${selectedStoreForForm}`}
                            value={selectedStoreForForm || ""}
                            onValueChange={(value) => setSelectedStoreForForm(value || undefined)}
                        >
                            <SelectTrigger id="store-select-new-bill-trigger" className="w-full sm:w-auto sm:min-w-[180px] h-9 select-trigger-class">
                              <SelectValue placeholder="Select Store..." />
                            </SelectTrigger>
                            <SelectContent position="popper">
                            {allStoresState.map(store => ( <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem> ))}
                            </SelectContent>
                        </Select>
                    )}
                    {hasMounted && isAdminContext && (isStarterPlan || allStoresState.length === 1) && allStoresState.length > 0 && (
                        <span className="text-sm font-semibold text-primary flex items-center gap-1 p-2 border border-input rounded-md h-9 bg-muted/50 w-full sm:w-auto">
                            <Building size={16} />
                            {allStoresState.find(s => s.id === selectedStoreForForm)?.name || allStoresState[0]?.name}
                        </span>
                    )}
                 </div>
            )}
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
          key={`new-bill-form-${effectiveModeForTitle}-${selectedStoreForForm}`} 
          initialModeProp={modeFromUrl}
          isAdminContext={true}
          preselectedStoreId={selectedStoreForForm}
        />
      </>
    );
  }

  const newBillHrefPath = `/admin/billing?action=new&mode=sell${currentContextStoreId ? `&storeId=${currentContextStoreId}` : (allStoresState.length === 1 ? `&storeId=${allStoresState[0].id}` : '')}`;
  
  const mainPageActions = (
    <>
      {(hasMounted && isAdminContext && allStoresState.length > 0 && activeBillingView === 'history' || activeBillingView === 'history') && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full">
          {hasMounted && isAdminContext && allStoresState.length > 0 && activeBillingView === 'history' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium whitespace-nowrap text-muted-foreground shrink-0">New Bill Store:</span>
              <HistoryStoreSelector stores={allStoresState} activePlanId={activePlan?.id} currentStoreId={currentContextStoreId} onStoreChange={setCurrentContextStoreId} />
            </div>
          )}
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
        </div>
      )}
        <Button onClick={() => handleViewToggle(activeBillingView === 'history' ? 'ledger' : 'history')} variant="outline" className="w-full md:w-auto">
            {activeBillingView === 'history' ? <ListChecks className="mr-2 h-4 w-4" /> : <HistoryIcon className="mr-2 h-4 w-4" />}
            {activeBillingView === 'history' ? 'Inventory Ledger' : 'Bill History'}
        </Button>
        <Button asChild className="w-full md:w-auto">
            <Link 
              href={newBillHrefPath}
              onClick={(e) => {
                if (isAdminContext && allStoresState.length === 0 && activePlan && activePlan.maxStores > 0) {
                  e.preventDefault();
                  setShowNoStoreAlertDialog(true);
                }
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Bill
            </Link>
        </Button>
        <AlertDialog open={showNoStoreAlertDialog} onOpenChange={setShowNoStoreAlertDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>No Store Found</AlertDialogTitle>
              <AlertDialogDescription>
                You don&apos;t have a store set up yet. Would you like to add one now?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowNoStoreAlertDialog(false); setShowStoreFormDialog(true); }}>Yes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <StoreFormDialog 
          isOpen={showStoreFormDialog} 
          onOpenChange={setShowStoreFormDialog} 
          onFormSubmit={() => { refresh(["stores"]); }} 
          allStaff={staffsFromZustand} 
        />
    </>
  );

  const pageTitleText = activeBillingView === 'ledger' ? 'Inventory Ledger' : 'Bill History';
  const pageTitleIcon = activeBillingView === 'ledger' ? BarChart2 : HistoryIcon;

  return (
    <>
      <PageTitle title={pageTitleText} icon={pageTitleIcon} actions={mainPageActions} />
      {activeBillingView === 'ledger' ? <InventoryLedgerTable /> : 
        <BillHistoryTable 
            key={`${timePeriodFilter}-${customDateRange?.from?.toISOString()}-${customDateRange?.to?.toISOString()}-${currentContextStoreId || 'all-stores'}`}
            filterByStoreId={currentContextStoreId}
            timePeriodFilter={timePeriodFilter} 
            customStartDate={customDateRange?.from} 
            customEndDate={customDateRange?.to}
        />
      }
    </>
  );
}

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <LoadingSpinner text="Loading Billing Information..." />
  </div>
);


export default function AdminBillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<LoadingFallback />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}
