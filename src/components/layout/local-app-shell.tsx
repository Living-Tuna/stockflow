
"use client";

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { LocalSidebarNav } from './local-sidebar-nav';
import { LocalHeaderMain } from './local-header-main';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WhatsappLauncher } from '@/components/whatsapp/whatsapp-launcher';

export function LocalAppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <TooltipProvider> 
        <div className="flex min-h-screen w-full bg-muted/40">
          <LocalSidebarNav /> 
          <SidebarInset className="flex flex-col flex-1 overflow-x-hidden bg-background">
            <LocalHeaderMain /> 
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
