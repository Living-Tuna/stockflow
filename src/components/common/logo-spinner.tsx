"use client";

import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useThemeLogo } from '@/hooks/use-theme-logo';

interface LogoSpinnerProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * The app logo rotating slow → fast → slow, looped. Drop-in replacement for
 * any bare spinner (Loader2, LoadingSpinner, etc.) as the universal loading
 * indicator.
 */
export function LogoSpinner({ size = 16, className, alt }: LogoSpinnerProps) {
  const themeLogo = useThemeLogo();

  return (
    <span
      className={cn(
        'animate-logo-loading inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full align-middle',
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={themeLogo}
        alt={alt ?? `${APP_NAME} Logo`}
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}