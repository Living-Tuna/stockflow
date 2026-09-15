
"use client";

import { useState, useEffect, useTransition } from 'react';
import type { Company, User, SubscriptionType } from '@/types';
import { getCustomers, markAsPaid, approveSubscriptionChange, rejectSubscriptionChange } from '../actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface CustomerData {
  company: Company;
  admin: User | null;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isUpdating, startUpdateTransition] = useTransition();
  const { toast } = useToast();

  const fetchAndSetCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await getCustomers();
      setCustomers(data);
      setHasError(false);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAndSetCustomers();
  }, []);
  
  const handleMarkAsPaid = (companyId: string, subscriptionType: SubscriptionType) => {
    startUpdateTransition(async () => {
      const result = await markAsPaid(companyId, subscriptionType);
      if (result.success) {
        toast({ title: 'Success', description: `Company ${companyId} marked as paid.` });
        await fetchAndSetCustomers();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const handleApproveSubscription = (companyId: string) => {
    startUpdateTransition(async () => {
        const result = await approveSubscriptionChange(companyId);
        if (result.success) {
            toast({ title: 'Approved', description: 'Subscription change approved.' });
            await fetchAndSetCustomers();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  };

  const handleRejectSubscription = (companyId: string) => {
    startUpdateTransition(async () => {
        const result = await rejectSubscriptionChange(companyId);
        if (result.success) {
            toast({ title: 'Rejected', description: 'Subscription change rejected.' });
            await fetchAndSetCustomers();
        } else {
             toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-card rounded-lg shadow-md">
        <LoadingSpinner text="Loading customer data..." />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600 mb-2">Failed to load subscription data</div>
          <p className="text-sm text-muted-foreground mb-4">
            Could not fetch companies from the database. Check the Supabase connection and try again.
          </p>
          <Button onClick={() => fetchAndSetCustomers()} disabled={isUpdating}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Customer Subscriptions</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company / Admin</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan & Cycle</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status & Dates</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
            {customers.map(({ company, admin }) => {
              const creationDate = company.creationDate ? parseISO(company.creationDate) : null;
              let trialEndDate: Date | null = null;
              if (creationDate) {
                  trialEndDate = new Date(creationDate);
                  trialEndDate.setDate(trialEndDate.getDate() + 7);
              }
              const isTrialActive = trialEndDate && new Date() < trialEndDate;

              return (
              <tr key={company.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</div>
                  <div className="text-sm text-gray-500">{admin?.email || 'No admin found'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{company.activeSubscriptionId}</div>
                  <div className="text-sm text-gray-500 capitalize">{company.subscriptionType}</div>
                  {company.pendingSubscriptionId && (
                      <div className="mt-2 p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800">
                          <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">Requesting:</div>
                          <div className="text-xs text-amber-900 dark:text-amber-300 font-medium">{company.pendingSubscriptionId}</div>
                          <div className="flex gap-1 mt-1">
                              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleApproveSubscription(company.id)} disabled={isUpdating}>
                                  <Check className="h-3 w-3 text-green-600" />
                              </Button>
                               <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleRejectSubscription(company.id)} disabled={isUpdating}>
                                  <X className="h-3 w-3 text-red-600" />
                              </Button>
                          </div>
                      </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {company.paymentStatus === 'paid' ? (
                        <>
                            <Badge className="bg-green-100 text-green-800">Paid</Badge>
                            <div className="text-xs text-gray-500 mt-1">
                                Expires: {company.subscriptionExpiryDate ? format(parseISO(company.subscriptionExpiryDate), 'PP') : 'N/A'}
                            </div>
                        </>
                    ) : (
                        <>
                            {isTrialActive ? (
                                <Badge className="bg-blue-100 text-blue-800">7-Day Trial</Badge>
                            ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Payment Pending</Badge>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                                {isTrialActive ? `Trial Ends: ${format(trialEndDate!, 'PP')}` : 'Trial Expired'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Signed up: {creationDate ? format(creationDate, 'PP') : 'N/A'}
                            </div>
                        </>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {company.paymentStatus === 'pending' ? (
                     <Button
                        size="sm"
                        onClick={() => handleMarkAsPaid(company.id, company.subscriptionType || 'monthly')}
                        disabled={isUpdating}
                      >
                         {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Mark as Paid
                      </Button>
                  ) : (
                    <span className="text-green-600 font-semibold">Active</span>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
