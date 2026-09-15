"use client";

import React from 'react';
import { useScannerBridge, SCANNER_BRIDGE_HEALTH_URL } from '@/hooks/use-scanner-bridge';
import { cn } from '@/lib/utils';
import { QrCode, Radio, RadioOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export function ScannerBridgeStatus() {
  const { connected, captureMode, version } = useScannerBridge();

  const label = connected
    ? captureMode === 'global'
      ? 'Scanner Bridge: Online (Global)'
      : captureMode === 'window'
      ? 'Scanner Bridge: Online'
      : 'Scanner Bridge: Connected'
    : 'Scanner Bridge: Off';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={SCANNER_BRIDGE_HEALTH_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium no-underline',
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-muted bg-muted/40 text-muted-foreground'
            )}
            title={label}
          >
            {connected ? (
              <Radio className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <RadioOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{label}</span>
            <QrCode className="ml-0.5 h-3 w-3 opacity-60" />
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {connected
              ? `Connected to local scanner bridge${version ? ` (v${version})` : ''} — scanning barcodes auto-adds products to the bill.`
              : 'Desktop scanner bridge not detected. Start the ecbills bridge app (taskbar icon) to enable automated barcode billing.'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}