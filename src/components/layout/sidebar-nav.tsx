"use client";

import { useState, useEffect, Suspense } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_LINK_GROUPS, SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { Sidebar, SidebarHeader, SidebarContent, useSidebar } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandMark } from '@/components/common/brand-mark';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { SidebarNavMenu } from './sidebar-nav-menu';

const ADMIN_ONLY_LINKS = ['/admin/stores', '/admin/staff', '/admin/chat'];

function SidebarNavMenuContent() {
  const getActiveSubscriptionPlan = useInventoryStore((state) => state.getActiveSubscriptionPlan);
  const [activePlanId, setActivePlanId] = useState<string | undefined>(undefined);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      setActivePlanId(getActiveSubscriptionPlan()?.id);
    }
  }, [hasMounted, getActiveSubscriptionPlan]);

  const isLinkDisabled = (link: { href: string }) =>
    hasMounted &&
    activePlanId === SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY &&
    ADMIN_ONLY_LINKS.includes(link.href);

  return <SidebarNavMenu groups={NAV_LINK_GROUPS} isLinkDisabled={isLinkDisabled} />;
}

function SidebarNavInner() {
  const { state: sidebarState, toggleSidebar } = useSidebar();

  return (
    <Sidebar className="border-r border-border" collapsible="icon">
      <SidebarHeader className="h-16 border-b border-border">
        <div className={cn("flex h-full items-center", sidebarState === "expanded" ? "justify-between pl-4 pr-3" : "justify-center")}>
          {sidebarState === "expanded" ? (
            <BrandMark href="/admin" preferCompanyBrand textClassName="text-xl" />
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
            <SidebarNavMenuContent />
          </Suspense>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}

export function SidebarNav() {
  return <SidebarNavInner />;
}
