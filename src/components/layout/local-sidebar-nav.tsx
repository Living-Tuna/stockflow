"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, useSidebar, SidebarSeparator, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarGroupLabel } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronLeft, ChevronDown, LayoutDashboard, DollarSign, Package, BookOpen, Settings as SettingsIcon, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useState } from 'react';

export interface LocalNavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children?: { href: string; label: string; secondary?: string }[];
}

export interface LocalNavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: LocalNavLink[];
}

export const LOCAL_NAV_LINKS: LocalNavGroup[] = [
  {
    title: "Operations",
    icon: Store,
    links: [
      { href: '/local', label: 'Dashboard', icon: LayoutDashboard, description: 'Daily overview' },
      { href: '/local/billing', label: 'Billing', icon: DollarSign, description: 'Create & manage bills' },
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
    icon: SettingsIcon,
    links: [
      { href: '/local/settings', label: 'Settings', icon: SettingsIcon, description: 'Workspace options' },
    ],
  },
];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/local" && pathname.startsWith(href));
}

export function LocalSidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      <SidebarHeader className="h-16 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-sidebar-border">
        <div className={cn("flex items-center h-full", sidebarState === 'expanded' ? "justify-between pl-3 pr-2" : "justify-center")}>
          {sidebarState === 'expanded' ? (
            <Link href="/local" className="flex items-center gap-3 overflow-hidden">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Store className="h-6 w-6" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold text-foreground">Local Mode</span>
                <span className="truncate text-xs text-muted-foreground">Offline workspace</span>
              </span>
            </Link>
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
          <SidebarMenu className="px-2 space-y-2">
            {LOCAL_NAV_LINKS.map((group, groupIndex) => (
              <React.Fragment key={group.title}>
                {sidebarState === 'expanded' && (
                  <SidebarGroupLabel className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group.title}
                  </SidebarGroupLabel>
                )}
                {group.links.map((link) => {
                  const hasChildren = Array.isArray(link.children) && link.children.length > 0;
                  const isActive = isLinkActive(pathname, link.href);
                  const isChildActive = hasChildren && link.children!.some((child) => isLinkActive(pathname, child.href));
                  const isExpanded = hasChildren && !collapsedGroups[link.href];

                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        asChild
                        size="default"
                        isActive={isActive || isChildActive}
                        tooltip={link.label}
                        className={cn(
                          "h-12 rounded-xl text-base font-medium text-sidebar-foreground/80 hover:bg-primary/5 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold data-[active=true]:ring-1 data-[active=true]:ring-primary/20"
                        )}
                      >
                        <Link href={link.href} className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            (isActive || isChildActive) ? "bg-primary/15 text-primary" : "bg-sidebar-accent/60 text-muted-foreground group-hover/menu-button:text-primary"
                          )}>
                            <link.icon className="h-[18px] w-[18px]" />
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
                      {hasChildren && sidebarState === 'expanded' && isExpanded && (
                        <SidebarMenuSub className="ml-[calc(theme(spacing.3)+theme(spacing.5)+theme(spacing.3))] border-l-2 border-primary/20 pl-3">
                          {link.children!.map((child) => {
                            const childActive = isLinkActive(pathname, child.href);
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={childActive}
                                  className={cn(
                                    "py-2 rounded-lg data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                                  )}
                                >
                                  <Link href={child.href}>
                                    <span className="flex flex-col gap-0.5 py-0.5">
                                      <span className="truncate text-sm font-medium">{child.label}</span>
                                      {child.secondary && (
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
                {groupIndex < LOCAL_NAV_LINKS.length - 1 && <SidebarSeparator className="my-2" />}
              </React.Fragment>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}