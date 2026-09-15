
"use client";
import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, PackageSearch, DollarSign, ShoppingBag, Send, RotateCcw, BarChart3, TrendingUp, ListChecks, History } from 'lucide-react';
import { SalesExpensesOverviewChart } from '@/components/dashboard/sales-expenses-overview-chart';
import { TopProductsChart } from '@/components/dashboard/top-products-chart';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import type { Bill, TimePeriod } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExpenseTrackerCard } from '@/components/dashboard/expense-tracker-card';
import { ExpenseSummaryStats } from '@/components/dashboard/expense-summary-stats';
import { OverallFinancialSummaryStats } from '@/components/dashboard/OverallFinancialSummaryStats'; 
import { TopProfitableProductsChart } from '@/components/dashboard/TopProfitableProductsChart'; 
import { getCurrencySymbol } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTransition } from '@/hooks/use-page-transition';


function getBillTypeIconAndColor(billType: Bill['type'], isDefectiveReturn?: boolean): { icon: JSX.Element; colorClass: string; name: string } {
    if (billType === 'buy') return { icon: <ShoppingBag className="h-4 w-4" />, colorClass: 'text-red-50 bg-red-600', name: 'Purchase' };
    if (billType === 'sell') return { icon: <Send className="h-4 w-4" />, colorClass: 'text-green-50 bg-green-600', name: 'Sales' };
    if (isDefectiveReturn) return { icon: <RotateCcw className="h-4 w-4" />, colorClass: 'text-amber-900 bg-amber-400 dark:text-amber-50 dark:bg-amber-600', name: 'Return (Defective)' };
    return { icon: <RotateCcw className="h-4 w-4" />, colorClass: 'text-amber-900 bg-amber-400 dark:text-amber-50 dark:bg-amber-600', name: 'Return' };
};

export default function DashboardPage() {
  const getRecentBillsFromStore = useInventoryStore((state) => state.getRecentBills);
  const userProfile = useInventoryStore((state) => state.userProfile);
  const { ensureLoaded } = useAppData();
  
  const [hasMounted, setHasMounted] = useState(false);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
  const playPageTransition = usePageTransition();

  useEffect(() => {
    setHasMounted(true);
    setCurrencySymbol(getCurrencySymbol(userProfile.companyCurrency));
  }, [userProfile.companyCurrency]);

  useEffect(() => {
    if (!hasMounted) return;
    ensureLoaded(['products', 'bills', 'customers']);
  }, [hasMounted, ensureLoaded]);

  useEffect(() => {
    if (hasMounted) {
      const companyId = localStorage.getItem('companyId') || undefined;
      setRecentBills(getRecentBillsFromStore(5, companyId));
    }
  }, [hasMounted, getRecentBillsFromStore]);

  return (
    <div className={cn("flex flex-col gap-8", playPageTransition && "page-transition")}>
      <PageTitle 
        title="Local Dashboard" 
        actions={
          <Tabs defaultValue={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      
      <OverviewStats period={timePeriod} />

      <OverallFinancialSummaryStats period={timePeriod} /> 

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-hover-effect">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Sales & Purchases
            </CardTitle>
            <CardDescription>Overview of sales and purchases for the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <SalesExpensesOverviewChart period={timePeriod} />
          </CardContent>
        </Card>
        <Card className="card-hover-effect">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Selling Products/SKUs
            </CardTitle>
            <CardDescription>Products/SKUs generating the most revenue for the period.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <TopProductsChart period={timePeriod} />
          </CardContent>
        </Card>
      </div>

      <Card className="card-hover-effect">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" /> 
              Top Profitable Products (Revenue vs. Cost)
          </CardTitle>
          <CardDescription>Comparison of revenue and cost for top profitable products/SKUs for the period.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] md:h-[300px] pt-4">
          <TopProfitableProductsChart period={timePeriod} />
        </CardContent>
      </Card>
      
      <ExpenseSummaryStats />
      <ExpenseTrackerCard />


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover-effect">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Start common tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            <Button asChild variant="default" className="w-full justify-start text-base py-3 transition-all-fast hover:scale-[1.02]">
              <Link href="/local/billing?mode=sell">
                <Send className="mr-2 h-4 w-4" /> New Sales Bill
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start text-base py-3 transition-all-fast hover:scale-[1.02] hover:bg-accent hover:border-primary/50">
              <Link href="/local/billing?mode=buy">
                <ShoppingBag className="mr-2 h-4 w-4" /> New Purchase Bill
              </Link>
            </Button>
             <Button asChild variant="outline" className="w-full justify-start text-base py-3 transition-all-fast hover:scale-[1.02] hover:bg-accent hover:border-primary/50">
              <Link href="/local/products/add">
                <PackageSearch className="mr-2 h-4 w-4" /> Add New Product
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover-effect">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest 5 bills processed.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {!hasMounted || recentBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent bills to display.</p>
            ) : (
              recentBills.map(bill => {
                const displayInfo = getBillTypeIconAndColor(bill.type, bill.items.some(i => i.isDefective));
                const amountColor = bill.type === 'buy' ? 'text-red-600' : 'text-green-600';
                return (
                  <div key={bill.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-tertiary shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-1.5 rounded-full", displayInfo.colorClass)}>
                         {React.cloneElement(displayInfo.icon, { className: "h-5 w-5" })}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{displayInfo.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {bill.vendorOrCustomerName || `Bill ID: ${bill.id.slice(-6)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={cn("font-semibold", amountColor)}>{currencySymbol}{bill.totalAmount.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(bill.date), 'PP p')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        
        <Card className="card-hover-effect">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Quick Links
            </CardTitle>
             <CardDescription>Navigate to important sections.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-4">
            <Button asChild variant="link" className="text-base w-full justify-start p-1 h-auto text-muted-foreground hover:text-primary hover:no-underline hover:translate-x-1 transition-all-fast">
              <Link href="/local/products">View All Products</Link>
            </Button>
            <Button asChild variant="link" className="text-base w-full justify-start p-1 h-auto text-muted-foreground hover:text-primary hover:no-underline hover:translate-x-1 transition-all-fast">
              <Link href="/local/billing">View Bill History</Link>
            </Button>
            <Button asChild variant="link" className="text-base w-full justify-start p-1 h-auto text-muted-foreground hover:text-primary hover:no-underline hover:translate-x-1 transition-all-fast">
              <Link href="/local/accounting">Accounting Reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
