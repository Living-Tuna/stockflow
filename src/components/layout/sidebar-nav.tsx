"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_LINK_GROUPS, SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, useSidebar, SidebarSeparator, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarGroupLabel } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useState, useEffect } from 'react';
import { BrandMark } from '@/components/common/brand-mark';

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const getActiveSubscriptionPlan = useInventoryStore((state) => state.getActiveSubscriptionPlan);

  const [hasMounted, setHasMounted] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | undefined>(undefined);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      const plan = getActiveSubscriptionPlan();
      setActivePlanId(plan?.id);
    }
  }, [hasMounted, getActiveSubscriptionPlan]);

  const isDisabledBySubscriptionFor = (link: { href: string }): boolean => {
    return hasMounted && activePlanId === SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY &&
      (link.href === '/admin/stores' || link.href === '/admin/staff' || link.href === '/admin/chat');
  };

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      <SidebarHeader className="h-16">
        <div className={cn("flex items-center h-full", sidebarState === 'expanded' ? "justify-between pl-3 pr-2" : "justify-center")}>
          {sidebarState === 'expanded' ? (
            <BrandMark href="/admin" preferCompanyBrand textClassName="text-xl" />
          ) : (
             <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-primary hover:text-primary/80 hover:bg-sidebar-accent"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center"><p>Expand Sidebar</p></TooltipContent>
            </Tooltip>
          )}

          {sidebarState === 'expanded' && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hidden md:flex text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
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
      <SidebarContent className="pt-2">
        <ScrollArea className="flex-1">
          <SidebarMenu className="px-2">
            {NAV_LINK_GROUPS.map((group, groupIndex) => (
              <React.Fragment key={group.title || `group-${groupIndex}`}>
                {group.title && sidebarState === 'expanded'
                  ? (
                    <SidebarGroupLabel className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group.title}
                    </SidebarGroupLabel>
                  )
                  : null}
                {group.links.map((link) => {
                  const isDisabledBySubscription = isDisabledBySubscriptionFor(link);
                  const hasChildren = Array.isArray(link.children) && link.children.length > 0;
                  const isActive = isLinkActive(pathname, link.href);
                  const isChildActive = hasChildren && link.children!.some((child) => isLinkActive(pathname, child.href));
                  const isExpanded = hasChildren && !collapsedGroups[link.href];

                  const menuItemContent = (
                    <SidebarMenuButton
                      asChild
                      size="default"
                      isActive={isActive || isChildActive}
                      tooltip={isDisabledBySubscription ? 'Upgrade to access this feature' : link.label}
                      aria-disabled={isDisabledBySubscription}
                      className={cn(
                        "h-12 text-base font-medium text-sidebar-foreground/80 hover:text-primary data-[active=true]:text-primary data-[active=true]:bg-primary/10 data-[active=true]:font-semibold",
                        isDisabledBySubscription && "opacity-50 cursor-not-allowed !bg-transparent !text-sidebar-foreground/50 hover:!text-sidebar-foreground/50"
                      )}
                    >
                      <Link
                        href={isDisabledBySubscription ? "#" : link.href}
                        className={cn("flex items-center gap-3", isDisabledBySubscription && "pointer-events-none")}
                        onClick={(e) => { if (isDisabledBySubscription) e.preventDefault(); }}
                      >
                        <span className="relative">
                          <link.icon className={cn("h-5 w-5 shrink-0", (isActive || isChildActive) && "text-primary")} />
                          {isChildActive && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </span>
                        {sidebarState === 'expanded' && (
                          <span className="flex min-w-0 flex-col gap-0.5 truncate">
                            <span className="truncate">{link.label}</span>
                            {link.description && (
                              <span className={cn(
                                "truncate text-xs font-normal text-muted-foreground/70",
                                (isActive || isChildActive) && "text-primary/70"
                              )}>
                                {link.description}
                              </span>
                            )}
                          </span>
                        )}
                        {hasChildren && sidebarState === 'expanded' && (
                          <span
                            className="ml-auto shrink-0 rounded p-0.5 transition-transform"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCollapsedGroups((prev) => ({ ...prev, [link.href]: isExpanded }));
                            }}
                          >
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground/60 transition-transform", isExpanded && "rotate-180")} />
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  );

                  return (
                    <SidebarMenuItem key={link.href}>
                      {menuItemContent}
                      {hasChildren && sidebarState === 'expanded' && isExpanded && (
                        <SidebarMenuSub className="ml-[calc(theme(spacing.3)+theme(spacing.5)+theme(spacing.3))] border-l-2 border-primary/20 pl-3">
                          {link.children!.map((child) => {
                            const childActive = isLinkActive(pathname, child.href);
                            const childDisabled = child.disabled || isDisabledBySubscriptionFor(child);
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={childActive}
                                  className={cn(
                                    "py-2 data-[active=true]:bg-primary/10 data-[active=true]:text-primary",
                                    childDisabled && "opacity-50 pointer-events-none"
                                  )}
                                >
                                  <Link href={childDisabled ? "#" : child.href}>
                                    <span className="flex flex-col gap-0.5 py-0.5">
                                      <span className="truncate text-sm font-medium">{child.label}</span>
                                      {child.secondary && sidebarState === 'expanded' && (
                                        <span className={cn("truncate text-xs font-normal text-muted-foreground/70", childActive && "text-primary/70")}>
                                          {child.secondary}
                                        </span>
                                      )}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
                {groupIndex < NAV_LINK_GROUPS.length - 1 && <SidebarSeparator className="my-2" />}
              </React.Fragment>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}