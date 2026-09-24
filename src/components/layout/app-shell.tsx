
"use client";

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { HeaderMain } from '@/components/layout/header-main';
import { Toaster } from '@/components/ui/toaster';
import { useEffect } from 'react';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WhatsappLauncher } from '@/components/whatsapp/whatsapp-launcher';

export function AppShell({ children }: { children: React.ReactNode }) {
  // Ensure Zustand store is hydrated on client
  useEffect(() => {
    // Zustand's persist middleware handles rehydration automatically.
    // The _hydrate method in the store is called via onRehydrateStorage.
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <TooltipProvider> 
        <div className="flex min-h-screen w-full bg-muted/40">
          <SidebarNav /> 
          <SidebarInset className="flex flex-col flex-1 overflow-x-hidden bg-background">
            <HeaderMain /> 
            <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
              {children}
            </div>
          </SidebarInset>
        </div>
        <Toaster />
        <WhatsappLauncher />
      </TooltipProvider>
    </SidebarProvider>
  );
}
