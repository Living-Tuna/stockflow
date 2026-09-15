
"use client";

import React, { useState, Suspense, useMemo } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CalendarDays, FileText, BarChart2, Wallet, Scale, PrinterIcon, Building } from 'lucide-react';
import { LogoSpinner } from '@/components/common/logo-spinner';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { ProfitLossStatement } from '@/components/accounting/profit-loss-statement';
import { GstReport } from '@/components/accounting/sales-tax-report';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AccountsReceivableCard } from '@/components/accounting/AccountsReceivableCard';
import { AccountsPayableCard } from '@/components/accounting/AccountsPayableCard';
import { CashFlowStatement } from '@/components/accounting/CashFlowStatement';
import { BalanceSheet } from '@/components/accounting/BalanceSheet';
import { generateReportPrintContent, triggerPrint } from '@/lib/print-utils';
import { useInventoryStore } from '@/hooks/use-inventory-store';

type TimePeriodPreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'thisFY' | 'lastFY' | 'all' | 'custom';
type AccountingTab = 'pnl' | 'cashflow' | 'balance-sheet' | 'gst';

function getFiscalYearDates(date: Date, offsetYears: number = 0): { from: Date, to: Date } {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-11
  
  let fiscalYearStartYear = currentMonth >= 3 ? currentYear : currentYear - 1; // In India, FY is April-March. April is month 3.
  fiscalYearStartYear -= offsetYears;

  const from = new Date(fiscalYearStartYear, 3, 1); // April 1st
  const to = new Date(fiscalYearStartYear + 1, 2, 31); // March 31st
  return { from, to };
}


function getDatesFromPreset(preset: TimePeriodPreset): DateRange | undefined {
  const now = new Date();
  switch (preset) {
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'lastMonth':
      const lastMonthStart = startOfMonth(subDays(now, now.getDate() + 1));
      return { from: lastMonthStart, to: endOfMonth(lastMonthStart) };
    case 'thisQuarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'lastQuarter':
      const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
      return { from: lastQuarterStart, to: endOfQuarter(lastQuarterStart) };
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) };
    case 'lastYear':
       const lastYearStart = startOfYear(subDays(now, 365));
       return { from: lastYearStart, to: endOfYear(lastYearStart) };
    case 'thisFY':
        return getFiscalYearDates(now);
    case 'lastFY':
        return getFiscalYearDates(now, 1);
    case 'all':
      return { from: new Date(2000, 0, 1), to: endOfYear(subDays(now, -365*5)) }; 
    default:
      return undefined;
  }
}

function AccountingPageContent() {
  const [timePeriodPreset, setTimePeriodPreset] = useState<TimePeriodPreset>('thisMonth');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDatesFromPreset('thisMonth'));
  const [activeTab, setActiveTab] = useState<AccountingTab>('pnl');
  const { userProfile, getAllStores } = useInventoryStore(state => ({
    userProfile: state.userProfile,
    getAllStores: state.getAllStores,
  }));
  
  const stores = useMemo(() => getAllStores(), [getAllStores]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  
  const handlePresetChange = (preset: TimePeriodPreset) => {
    setTimePeriodPreset(preset);
    if (preset !== 'custom') {
      setDateRange(getDatesFromPreset(preset));
    }
  };
  
  const handleCustomDateChange = (newRange: DateRange | undefined) => {
    setTimePeriodPreset('custom');
    setDateRange(newRange);
  }

  const handlePrintReport = () => {
    const reportContentEl = document.getElementById(`${activeTab}-report-content`);
    if (!reportContentEl) {
      console.error('Could not find report content element to print.');
      return;
    }
    
    let reportTitle = '';
    switch(activeTab) {
        case 'pnl': reportTitle = 'Profit & Loss Statement'; break;
        case 'cashflow': reportTitle = 'Cash Flow Statement'; break;
        case 'balance-sheet': reportTitle = 'Simplified Financial Position'; break;
        case 'gst': reportTitle = 'GST Report'; break;
        default: reportTitle = 'Accounting Report';
    }

    const storeName = selectedStoreId === 'all' ? 'All Stores' : stores.find(s => s.id === selectedStoreId)?.name || '';
    reportTitle += ` (${storeName})`;

    const printContent = generateReportPrintContent(reportContentEl.innerHTML, reportTitle, userProfile);
    triggerPrint(printContent);
  };


  const pageActions = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
        {stores.length > 1 && (
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-9 select-trigger-class">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><Building className="mr-2 h-4 w-4 inline-block" />All Stores</SelectItem>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={timePeriodPreset} onValueChange={(value) => handlePresetChange(value as TimePeriodPreset)}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-9 select-trigger-class">
                <SelectValue placeholder="Filter by time" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
                <SelectItem value="thisFY">This Fiscal Year (Apr-Mar)</SelectItem>
                <SelectItem value="lastFY">Last Fiscal Year (Apr-Mar)</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
        </Select>
        {timePeriodPreset === 'custom' && (
            <Popover>
                <PopoverTrigger asChild>
                    <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:min-w-[260px] justify-start text-left font-normal h-9", !dateRange && "text-muted-foreground" )}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                            ) : ( format(dateRange.from, "LLL dd, y") )
                        ) : ( <span>Pick a date range</span> )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleCustomDateChange} numberOfMonths={2} />
                </PopoverContent>
            </Popover>
        )}
        <Button variant="outline" onClick={handlePrintReport} className="h-9">
            <PrinterIcon className="mr-2 h-4 w-4" /> Print Report
        </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6" id="accounting-reports-container">
      <PageTitle title="Accounting & Reports" icon={BookOpen} actions={pageActions} />

      <Tabs defaultValue="pnl" value={activeTab} onValueChange={(v) => setActiveTab(v as AccountingTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4 no-print">
          <TabsTrigger value="pnl" className="gap-2"><BarChart2 size={16}/>P&L Statement</TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2"><Wallet size={16}/>Cash Flow</TabsTrigger>
          <TabsTrigger value="balance-sheet" className="gap-2"><Scale size={16}/>Balance Sheet</TabsTrigger>
          <TabsTrigger value="gst" className="gap-2"><FileText size={16}/>GST Report</TabsTrigger>
        </TabsList>
        <div id="pnl-report-content">
            <TabsContent value="pnl" className="mt-6">
                <ProfitLossStatement startDate={dateRange?.from} endDate={dateRange?.to} storeId={selectedStoreId} />
            </TabsContent>
        </div>
         <div id="cashflow-report-content">
            <TabsContent value="cashflow" className="mt-6">
                <CashFlowStatement startDate={dateRange?.from} endDate={dateRange?.to} storeId={selectedStoreId} />
            </TabsContent>
        </div>
        <div id="balance-sheet-report-content">
            <TabsContent value="balance-sheet" className="mt-6">
                <BalanceSheet storeId={selectedStoreId} />
            </TabsContent>
        </div>
        <div id="gst-report-content">
            <TabsContent value="gst" className="mt-6">
                 <GstReport startDate={dateRange?.from} endDate={dateRange?.to} storeId={selectedStoreId}/>
            </TabsContent>
        </div>
      </Tabs>

      <Separator className="my-8 no-print" />
      
      <div className="space-y-4 no-print">
        <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Outstanding Balances</h2>
            <Badge variant="outline">Live Data</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
            These cards show current outstanding receivables and payables, and are not affected by the date filter above.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 mt-4 no-print">
        <AccountsReceivableCard storeId={selectedStoreId} />
        <AccountsPayableCard storeId={selectedStoreId} />
      </div>

    </div>
  );
}

const LoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
    <LogoSpinner size={32} />
    <p className="text-muted-foreground">Loading Accounting Reports...</p>
  </div>
);

export default function AccountingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AccountingPageContent />
    </Suspense>
  );
}
