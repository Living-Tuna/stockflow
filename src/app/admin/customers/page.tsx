
"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { CustomersTable } from '@/components/customers/customers-table';
import { Contact, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAppData } from '@/contexts/app-data-context';

function CustomersContent() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
    } else {
      console.error("Company ID not found in localStorage for CustomersPage.");
      toast({ variant: "destructive", title: "Error", description: "Company context missing. Cannot load customers."});
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (companyId) {
      setIsLoading(true);
      ensureLoaded(['customers']).finally(() => setIsLoading(false));
    }
  }, [companyId, ensureLoaded]);

  // Placeholder for Add Customer button action
  const handleAddCustomer = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Manually adding customers will be available in a future update.",
    });
  };
  
  if (isLoading && companyId) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <LoadingSpinner text="Fetching customer data..." />
      </div>
    );
  }
  if (!isLoading && !companyId) {
    return <div className="flex-1 flex items-center justify-center text-destructive">Could not load customers: Company ID missing.</div>
  }

  return (
    <>
      <PageTitle 
        title="Customers" 
        icon={Contact} 
        actions={
          <Button onClick={handleAddCustomer} disabled>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Customer (Soon)
          </Button>
        }
      />
      <CustomersTable />
    </>
  );
}

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <LoadingSpinner text="Loading Customers..." />
  </div>
);

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<LoadingFallback />}>
        <CustomersContent />
      </Suspense>
    </div>
  );
}
