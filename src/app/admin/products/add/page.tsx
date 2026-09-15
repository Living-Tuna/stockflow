
"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageTitle } from '@/components/common/page-title';
import { ProductForm } from '@/components/products/product-form';
import { PackagePlus } from 'lucide-react';
import { LogoSpinner } from '@/components/common/logo-spinner';

function AddProductPageContent() {
  const searchParams = useSearchParams();
  // Convert searchParams to a plain object for the ProductForm
  const paramsObj: { [key: string]: string } = {};
  searchParams.forEach((value, key) => {
    paramsObj[key] = value;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Add New Product" icon={PackagePlus} />
      <ProductForm searchParams={paramsObj} />
    </div>
  );
}

const LoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
    <LogoSpinner size={32} />
    <p className="text-muted-foreground">Loading Form...</p>
  </div>
);

export default function AddProductPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AddProductPageContent />
    </Suspense>
  );
}
