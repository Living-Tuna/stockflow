"use client";

import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useThemeLogo } from '@/hooks/use-theme-logo';

interface BrandMarkProps {
  href?: string;
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  showLocalBadge?: boolean;
  preferCompanyBrand?: boolean;
}

export function BrandMark({
  href,
  className,
  logoClassName,
  textClassName,
  showLocalBadge = false,
  preferCompanyBrand = false,
}: BrandMarkProps) {
  const userProfile = useInventoryStore((state) => state.userProfile);
  const companyLogo = preferCompanyBrand ? userProfile.companyLogoUrl : undefined;
  const companyName = preferCompanyBrand ? userProfile.companyName : undefined;
  const displayName = companyName?.trim() || APP_NAME;
  const themeLogo = useThemeLogo();
  const logoSrc = companyLogo?.trim() || themeLogo;

  const content = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden", logoClassName)}>
        <img
          src={logoSrc}
          alt={`${displayName} logo`}
          className="h-full w-full object-contain"
          onError={(event) => {
            const image = event.currentTarget;
            if (image.src.endsWith('/logo.svg')) return;
            image.src = themeLogo;
          }}
        />
      </span>
      <span className={cn("min-w-0 truncate text-sm text-primary-dark", textClassName)}>
        {/* {displayName} */}
        Hello!
        {showLocalBadge && <span className="ml-1 text-xs font-normal text-muted-foreground">(Local)</span>}
      </span>
    </>
  );

  const classes = cn("flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-85", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
