"use client";

import React from 'react';
import Link from 'next/link';
import { useScannerBridge } from '@/hooks/use-scanner-bridge';
import { cn } from '@/lib/utils';
import { SCANNER_BRIDGE_DOWNLOAD_PAGE } from '@/lib/scanner-bridge-downloads';
import { QrCode, Radio, Download, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export function ScannerBridgeStatus() {
  const { connected, captureMode, version } = useScannerBridge();

  const onlineLabel = connected
    ? captureMode === 'global'
      ? 'Scanner Bridge: Online (Global)'
      : captureMode === 'window'
      ? 'Scanner Bridge: Online'
      : 'Scanner Bridge: Connected'
    : 'Scanner Bridge: Off';

  return (
    <TooltipProvider>
      {connected ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              )}
              title={onlineLabel}
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden sm:inline">{onlineLabel}</span>
              <QrCode className="ml-0.5 h-3 w-3 opacity-60" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {`Connected to local scanner bridge${version ? ` (v${version})` : ''} — scanning barcodes auto-adds products to the bill.`}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={SCANNER_BRIDGE_DOWNLOAD_PAGE}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium no-underline transition-colors hover:bg-amber-500/10',
                'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              )}
              title="Scanner Bridge not installed — click to download"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scanning not set up</span>
              <Download className="ml-0.5 h-3 w-3" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Desktop scanner bridge not detected. Click to download the Windows or Linux edition — it pairs with this page over localhost to auto-add scanned products.</p>
          </TooltipContent>
        </Tooltip>
      )}
    </TooltipProvider>
  );
}