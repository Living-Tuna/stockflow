"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, useSidebar, SidebarSeparator, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarGroupLabel } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronLeft, ChevronDown, LayoutDashboard, DollarSign, Package, BookOpen, Settings as SettingsIcon, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useState, Suspense } from 'react';

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
    icon: SettingsIcon,
    links: [
      { href: '/local/settings', label: 'Settings', icon: SettingsIcon, description: 'Workspace options' },
    ],
  },
];

function isLinkActive(pathname: string, search: string, href: string): boolean {
  const [pathPart] = href.split('?');
  return pathname === pathPart || (pathPart !== "/local" && pathname.startsWith(pathPart));
}

function childIsActive(pathname: string, search: string, allChildren: { href: string }[], child: { href: string }): boolean {
  const hasQuery = child.href.includes('?');
  const [childPath, childQuery] = child.href.split('?');
  if (pathname !== childPath) return false;
  if (hasQuery) {
    const want = new URLSearchParams(childQuery);
    const cur = new URLSearchParams(search);
    for (const [k, v] of want) {
      if (cur.get(k) !== v) return false;
    }
    return true;
  }
  const anyQueryChildMatched = allChildren.some((c) => {
    if (!c.href.includes('?')) return false;
    const [cp, cq] = c.href.split('?');
    if (pathname !== cp) return false;
    const want = new URLSearchParams(cq);
    const cur = new URLSearchParams(search);
    return Array.from(want).every(([k, v]) => cur.get(k) === v);
  });
  if (anyQueryChildMatched) return false;
  if (pathname === child.href) return true;
  return pathname.startsWith(childPath) && !allChildren.some((c) => pathname === c.href.split('?')[0]);
}

function LocalSidebarNavMenu() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { state: sidebarState } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  return (
    <SidebarMenu className="px-2 space-y-2">
      {LOCAL_NAV_LINKS.map((group, groupIndex) => (
        <React.Fragment key={group.title}>
          {sidebarState === 'expanded' && (
            <SidebarGroupLabel className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group.title}
            </SidebarGroupLabel>
          )}
          {group.links.map((link) => {
            const hasChildren = Array.isArray(link.children) && link.children.length > 0;
            const isActive = isLinkActive(pathname, search, link.href) || (hasChildren ? link.children!.some((child) => childIsActive(pathname, search, link.children!, child)) : false);
            const isChildActive = hasChildren && link.children!.some((child) => childIsActive(pathname, search, link.children!, child));
            const isExpanded = hasChildren && !collapsedGroups[link.href];

            return (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  size="default"
                  isActive={isActive || isChildActive}
                  tooltip={link.label}
                  className={cn(
                    "h-12 rounded-xl text-base font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-bold data-[active=true]:ring-1 data-[active=true]:ring-sidebar-primary/40"
                  )}
                >
                  <Link href={link.href} className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      (isActive || isChildActive) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-accent/60 text-sidebar-foreground/60 group-hover/menu-button:text-sidebar-accent-foreground"
                    )}>
                      <link.icon className="h-[18px] w-[18px]" />
                    </span>
                    {sidebarState === 'expanded' && (
                      <span className="flex min-w-0 flex-col gap-0.5 truncate">
                        <span className="truncate">{link.label}</span>
                        {link.description && (
                          <span className={cn(
                            "truncate text-xs font-normal text-sidebar-foreground/60",
                            (isActive || isChildActive) && "font-medium text-sidebar-primary-foreground/90"
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
                        <ChevronDown className={cn("h-4 w-4 text-sidebar-foreground/60 transition-transform", isExpanded && "rotate-180")} />
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
                {hasChildren && sidebarState === 'expanded' && isExpanded && (
                  <SidebarMenuSub className="ml-[calc(theme(spacing.3)+theme(spacing.5)+theme(spacing.3))] border-l-2 border-sidebar-primary/40 pl-3">
                    {link.children!.map((child) => {
                      const childActive = childIsActive(pathname, search, link.children!, child);
                      return (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={childActive}
                            className={cn(
                              "py-2 rounded-lg data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-bold"
                            )}
                          >
                            <Link href={child.href}>
                              <span className="flex flex-col gap-0.5 py-0.5">
                                <span className="truncate text-sm font-medium">{child.label}</span>
                                {child.secondary && (
                                  <span className={cn("truncate text-xs font-normal text-sidebar-foreground/60", childActive && "font-medium text-sidebar-primary-foreground/90")}>
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
  );
}

function LocalSidebarNavInner() {
  const { state: sidebarState, toggleSidebar } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      <SidebarHeader className="h-16 bg-gradient-to-r from-sidebar-primary/20 via-sidebar-accent/10 to-transparent border-b border-sidebar-border">
        <div className={cn("flex items-center h-full", sidebarState === 'expanded' ? "justify-between pl-3 pr-2" : "justify-center")}>
          {sidebarState === 'expanded' ? (
            <Link href="/local" className="flex items-center gap-3 overflow-hidden">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-sidebar-primary/40">
                <Store className="h-6 w-6" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold text-sidebar-foreground">Local Mode</span>
                <span className="truncate text-xs text-sidebar-foreground/60">Offline workspace</span>
              </span>
            </Link>
          ) : (
             <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
                    className="h-9 w-9 hidden md:flex text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
          <Suspense fallback={null}>
            <LocalSidebarNavMenu />
          </Suspense>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}

export function LocalSidebarNav() {
  return <LocalSidebarNavInner />;
}