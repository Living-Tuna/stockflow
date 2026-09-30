"use client";

import { Suspense } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, DollarSign, Package, BookOpen, Settings as SettingsIcon, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavLinkGroup } from '@/lib/constants';
import { Sidebar, SidebarHeader, SidebarContent, useSidebar } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandMark } from '@/components/common/brand-mark';
import { SidebarNavMenu } from './sidebar-nav-menu';

export const LOCAL_NAV_LINKS: NavLinkGroup[] = [
  {
    title: "Operations",
    links: [
      { href: '/local', label: 'Dashboard', icon: LayoutDashboard, description: 'Daily overview' },
      {
        href: '/local/billing',
        label: 'Billing',
        icon: DollarSign,
        description: 'Create & manage bills',
        children: [
          { href: '/local/billing', label: 'Bill History', secondary: 'View past transactions' },
          { href: '/local/billing?view=ledger', label: 'Inventory Ledger', secondary: 'Stock movement report' },
          { href: '/local/billing?action=new&mode=sell', label: 'New Sales Bill', secondary: 'Create a sale invoice' },
        ],
      },
      {
        href: '/local/products',
        label: 'Products',
        icon: Package,
        description: 'Inventory catalogue',
        children: [
          { href: '/local/products', label: 'All Products', secondary: 'Browse available stock' },
        ],
      },
      { href: '/local/accounting', label: 'Accounting', icon: BookOpen, description: 'Ledger & reports' },
    ],
  },
  {
    title: "Workspace",
    links: [
      { href: '/local/settings', label: 'Settings', icon: SettingsIcon, description: 'Workspace options' },
    ],
  },
];

function SidebarNavInner() {
  const { state: sidebarState, toggleSidebar } = useSidebar();

  return (
    <Sidebar className="border-r border-border" collapsible="icon">
      <SidebarHeader className="h-16 border-b border-border">
        <div className={cn("flex h-full items-center", sidebarState === "expanded" ? "justify-between pl-4 pr-3" : "justify-center")}>
          {sidebarState === "expanded" ? (
            <BrandMark href="/local" preferCompanyBrand showLocalBadge textClassName="text-lg" />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-secondary-foreground/80 hover:bg-primary/10 hover:text-secondary-foreground"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center"><p>Expand Sidebar</p></TooltipContent>
            </Tooltip>
          )}

          {sidebarState === "expanded" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-9 w-9 text-secondary-foreground/80 hover:bg-primary/10 hover:text-secondary-foreground md:flex"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center"><p>Collapse Sidebar</p></TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <ScrollArea className="h-full" scrollBarClassName="bg-primary/60 hover:bg-primary">
          <Suspense fallback={null}>
            <SidebarNavMenu groups={LOCAL_NAV_LINKS} />
          </Suspense>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}

export function LocalSidebarNav() {
  return <SidebarNavInner />;
}
