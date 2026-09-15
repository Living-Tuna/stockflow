"use client";

import { cn } from '@/lib/utils';
import { LogoSpinner } from '@/components/common/logo-spinner';

interface BrandLoadingProps {
  size?: number;
  text?: string;
  className?: string;
}

/**
 * Full-screen style loading indicator: the app logo rotates slow → fast →
 * slow and loops until loading completes. Use instead of a bare spinner.
 */
export function BrandLoading({ size = 88, text, className }: BrandLoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
      <LogoSpinner size={size} />
      {text && <span className="mt-5 text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}