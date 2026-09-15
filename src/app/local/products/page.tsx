
"use client";

import { Suspense } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { ProductsTable } from '@/components/products/products-table';
import { Package } from 'lucide-react';
import { LogoSpinner } from '@/components/common/logo-spinner';

const LoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
    <LogoSpinner size={32} />
    <p className="text-muted-foreground">Loading Products...</p>
  </div>
);

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Products" icon={Package} />
      <Suspense fallback={<LoadingFallback />}>
        <ProductsTable />
      </Suspense>
    </div>
  );
}
