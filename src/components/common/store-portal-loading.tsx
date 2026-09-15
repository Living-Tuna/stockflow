"use client";

import { BrandLoading } from '@/components/common/brand-loading';

export function StorePortalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
      <BrandLoading size={88} text="Loading Store Portal..." />
    </div>
  );
}