"use client";

import React, { useState } from 'react';
import { WhatsappPanel } from '@/components/whatsapp/whatsapp-panel';
import { useIsMobile } from '@/hooks/use-mobile';
import { WHATSAPP_ENABLED } from '@/lib/client/whatsapp-client';
import { cn } from '@/lib/utils';

export function WhatsappLauncher() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!WHATSAPP_ENABLED) return null;
  if (!isMobile) return null;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-background">
          <div className="flex flex-1 min-h-0 p-2 pt-3">
            <WhatsappPanel variant="popup" onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open WhatsApp"
          className={cn(
            "fixed bottom-5 right-5 z-[80] flex h-14 w-14 items-center justify-center rounded-full",
            "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600",
            "transition-transform active:scale-95 items-end pb-3 justify-center"
          )}
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            <path
              fill="currentColor"
              d="M16 2.5C8.6 2.5 2.6 8.5 2.6 15.9c0 2.4.6 4.7 1.8 6.7L2.7 29.3l6.9-1.8c1.9 1.1 4.2 1.7 6.4 1.7 7.4 0 13.4-6 13.4-13.4S23.4 2.5 16 2.5zm0 24.4c-2.2 0-4.3-.6-6.1-1.7l-.4-.3-4.1 1.1 1.1-4-.3-.5c-1.3-1.9-2-4.2-2-6.6 0-6.1 5-11.1 11.1-11.1s11.1 5 11.1 11.1-4.9 12-7.4 12zm5.5-8.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"
            />
          </svg>
        </button>
      )}
    </>
  );
}