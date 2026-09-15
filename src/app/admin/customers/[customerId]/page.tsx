
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import type { Customer, Bill } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { User, Phone, Mail, MapPin, ShoppingCart, RotateCcw, DollarSign, CalendarDays, ChevronLeft, TrendingUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { getCurrencySymbol } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';


interface CustomerAnalytics {
  totalVisits: number;
  totalSpend: number;
  totalReturns: number;
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;
  
  const { getCustomerById, bills, userProfile } = useInventoryStore(state => ({
    getCustomerById: state.getCustomerById,
    bills: state.bills,
    userProfile: state.userProfile,
  }));
  const { ensureLoaded } = useAppData();

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  useEffect(() => {
    setCurrencySymbol(getCurrencySymbol(userProfile.companyCurrency));
  }, [userProfile.companyCurrency]);
  
  useEffect(() => {
    ensureLoaded(['customers', 'bills']);
  }, [ensureLoaded]);

  useEffect(() => {
    if (customerId) {
      setIsLoading(true);
      const fetchedCustomer = getCustomerById(customerId);
      setCustomer(fetchedCustomer || null);
      setIsLoading(false);
    }
  }, [customerId, getCustomerById]);
  
  const customerBills = useMemo(() => {
    if (!customer) return [];
    return bills.filter(bill => {
        if (bill.type === 'buy') return false; 
        const matchesPhone = customer.phone && bill.customerPhone === customer.phone;
        const matchesName = customer.name && bill.vendorOrCustomerName === customer.name;
        // If phone exists, it's the primary key. If not, fallback to name.
        return customer.phone ? matchesPhone : (matchesName && !bill.customerPhone);
    }).sort((a,b) => b.timestamp - a.timestamp);
  }, [customer, bills]);


  useEffect(() => {
     if (customer && customerBills) {
        const newAnalytics: CustomerAnalytics = {
            totalVisits: 0,
            totalSpend: 0,
            totalReturns: 0,
        };
        customerBills.forEach(bill => {
            if (bill.type === 'sell' && !bill.isEstimate) {
                newAnalytics.totalVisits += 1;
                newAnalytics.totalSpend += bill.totalAmount;
            } else if (bill.type === 'return') {
                newAnalytics.totalReturns += bill.totalAmount;
            }
        });
        setAnalytics(newAnalytics);
        setPurchaseHistory(customerBills);
     }
  }, [customer, customerBills]);


  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <LoadingSpinner text="Loading customer details..." />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center py-10">
        <PageTitle title="Customer Not Found" icon={User} />
        <p className="text-destructive">The customer you are trying to view could not be found.</p>
        <Button asChild variant="outline">
          <Link href="/admin/customers">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Customers List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageTitle 
        title={customer.name || `Customer ID: ${customer.id}`} 
        icon={User}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/customers">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {customer.name && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{customer.name}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{customer.email}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-foreground">{customer.address}</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-tertiary rounded-md mt-2">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Seen:</span>
                </div>
                <span className="font-medium text-foreground">{format(new Date(customer.lastSeen), 'PP')}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Activity Overview</CardTitle>
            <CardDescription>Summary of this customer's interactions.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <StatCard
                title="Total Visits"
                value={analytics?.totalVisits || 0}
                icon={ShoppingCart}
                description="Number of sales bills"
                isLoading={isLoading}
              />
              <StatCard
                title="Total Spend"
                value={`${currencySymbol}${analytics?.totalSpend.toFixed(2) || '0.00'}`}
                icon={DollarSign}
                description="Total revenue from sales"
                isLoading={isLoading}
                 valueClassName="text-primary"
              />
               <StatCard
                title="Value Returned"
                value={`${currencySymbol}${analytics?.totalReturns.toFixed(2) || '0.00'}`}
                icon={RotateCcw}
                description="Value of returned items"
                isLoading={isLoading}
                valueClassName="text-amber-600 dark:text-amber-500"
              />
          </CardContent>
        </Card>
      </div>

       <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Purchase History</CardTitle>
             <CardDescription>A detailed list of all purchases and returns made by this customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
             <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {purchaseHistory.length > 0 ? (
                    purchaseHistory.map(bill => (
                        <TableRow key={bill.id}>
                        <TableCell className="text-xs">{format(new Date(bill.date), 'PP p')}</TableCell>
                        <TableCell className="font-mono text-xs">{bill.id}</TableCell>
                        <TableCell>
                            <Badge
                            variant={bill.type === 'sell' ? 'default' : 'outline'}
                            className={bill.type === 'return' ? 'border-amber-500 text-amber-600' : ''}
                            >
                            {bill.type.charAt(0).toUpperCase() + bill.type.slice(1)}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">{bill.items.length}</TableCell>
                        <TableCell className="text-right font-semibold">{currencySymbol}{bill.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                            <Button variant="ghost" size="icon" asChild>
                                <Link href={`/admin/billing?action=view&billId=${bill.id}`}>
                                    <Eye className="h-4 w-4 text-primary" />
                                </Link>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                        No purchase history found for this customer.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

    </div>
  );
}

    

    