"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import type { NavLinkGroup, NavSubLink } from '@/lib/constants';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * The vertical rhythm of the rail. Content column starts at
 * 8px (SidebarContent p-2) + 12px (button px-3) + 20px (icon) + 12px (gap-3) = 52px.
 * Everything below lines up to those two numbers:
 *   - the sub-menu rail sits under the parent icon's centre (30px)
 *   - sub-item text lines up with parent text (52px)
 */
const RAIL_X = "ml-[22px]";
const RAIL_PAD = "pl-2";

const ROOTS = ["/admin", "/local"];

function isPathActive(pathname: string, href: string): boolean {
  const [pathPart] = href.split("?");
  // Segment-aware: "/admin" must not light up for "/admin/billing", and
  // "/admin/billing" must not light up for "/admin/billing-archive".
  if (ROOTS.includes(pathPart)) return pathname === pathPart;
  return pathname === pathPart || pathname.startsWith(`${pathPart}/`);
}

function isChildActive(
  pathname: string,
  search: string,
  allChildren: NavSubLink[],
  child: NavSubLink
): boolean {
  const [childPath, childQuery] = child.href.split("?");
  if (pathname !== childPath) return false;

  if (childQuery) {
    const want = new URLSearchParams(childQuery);
    const cur = new URLSearchParams(search);
    return Array.from(want).every(([k, v]) => cur.get(k) === v);
  }

  // No query on this child => it is the default view for the path, so it stays
  // active only while no query-carrying sibling claims the current URL.
  const siblingWithQueryMatches = allChildren.some((c) => {
    if (!c.href.includes("?")) return false;
    const [cp, cq] = c.href.split("?");
    if (pathname !== cp) return false;
    const want = new URLSearchParams(cq);
    const cur = new URLSearchParams(search);
    return Array.from(want).every(([k, v]) => cur.get(k) === v);
  });
  return !siblingWithQueryMatches;
}

export interface SidebarNavMenuProps {
  groups: NavLinkGroup[];
  /** Extra gate, e.g. subscription-plan locks. */
  isLinkDisabled?: (link: { href: string }) => boolean;
}

export function SidebarNavMenu({ groups, isLinkDisabled }: SidebarNavMenuProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { state: sidebarState } = useSidebar();

  // undefined = "no manual choice, follow the route". Keying on href (not the
  // group index) keeps state stable when groups are reordered.
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});

  const disabledFor = useCallback(
    (href: string) => Boolean(isLinkDisabled?.({ href })),
    [isLinkDisabled]
  );

  const isExpandedState = useCallback(
    (link: { href: string; children?: NavSubLink[] }) => {
      const children = link.children ?? [];
      if (children.length === 0) return false;
      const manual = manualOpen[link.href];
      if (typeof manual === "boolean") return manual;
      // Default open when the current route lives inside this group.
      return children.some((c) => isChildActive(pathname, search, children, c));
    },
    [manualOpen, pathname, search]
  );

  // Any manual toggle for a group that no longer has children is dead state.
  useEffect(() => {
    setManualOpen((prev) => {
      const live = new Set(groups.flatMap((g) => g.links.map((l) => l.href)));
      const next = Object.fromEntries(Object.entries(prev).filter(([k]) => live.has(k)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [groups]);

  const rendered = useMemo(
    () =>
      groups.map((group) => ({
        group,
        links: group.links.map((link) => {
          const children = link.children ?? [];
          const childActive = children.some((c) => isChildActive(pathname, search, children, c));
          return {
            link,
            childActive,
            isActive: isPathActive(pathname, link.href),
            isDisabled: disabledFor(link.href) || Boolean(link.disabled),
            isExpanded: isExpandedState(link),
            children,
          };
        }),
      })),
    [groups, pathname, search, disabledFor, isExpandedState]
  );

  return (
    <SidebarMenu className="gap-1">
      {rendered.map(({ group, links }, groupIndex) => (
        <React.Fragment key={group.title || `group-${groupIndex}`}>
          {group.title && sidebarState === "expanded" && (
            <SidebarGroupLabel className="h-7 px-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground/45">
              {group.title}
            </SidebarGroupLabel>
          )}

          {links.map(({ link, children, isActive, childActive, isExpanded, isDisabled }) => {
            const hasChildren = children.length > 0;
            const highlighted = isActive || childActive;
            const collapsed = sidebarState === "collapsed";

            return (
              <SidebarMenuItem key={link.href}>
                <div className="relative">
                  <SidebarMenuButton
                    asChild
                    size="default"
                    isActive={highlighted}
                    tooltip={isDisabled ? "Upgrade to access this feature" : link.label}
                    aria-disabled={isDisabled}
                    className={cn(
                      // min-h (not h-) via the size variant; py supplies the
                      // breathing room for the label + description stack.
                      "min-h-[3.25rem] rounded-xl px-2.5 py-2 text-[0.95rem] font-semibold transition-colors",
                      "text-secondary-foreground/85 hover:bg-primary/10 hover:text-primary-foreground",
                      "data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground",
                      // Reserve room for the disclosure button so the label
                      // never runs underneath it.
                      hasChildren && !collapsed && "pr-10",
                      isDisabled &&
                        "pointer-events-none opacity-50 data-[active=true]:!bg-transparent data-[active=true]:!text-secondary-foreground/60"
                    )}
                  >
                    <Link
                      href={isDisabled ? "#" : link.href}
                      className="flex min-w-0 items-center gap-3"
                      aria-disabled={isDisabled || undefined}
                    >
                      <span
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-lg transition-colors",
                          collapsed ? "h-6 w-6" : "h-8 w-8",
                          highlighted ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/15 text-secondary-foreground/70"
                        )}
                      >
                        <link.icon className={cn("h-[18px] w-[18px]", collapsed && "h-5 w-5 stroke-[2.5]")} />
                      </span>

                      {!collapsed && (
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate leading-tight">{link.label}</span>
                          {link.description && (
                            <span
                              className={cn(
                                "truncate text-xs font-normal leading-tight text-secondary-foreground/60",
                                highlighted && "text-primary-foreground/85"
                              )}
                            >
                              {link.description}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>

                  {hasChildren && !collapsed && (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${link.label}`}
                      onClick={() => setManualOpen((prev) => ({ ...prev, [link.href]: !isExpanded }))}
                      className={cn(
                        "absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md",
                        "text-secondary-foreground/60 transition-colors hover:bg-primary-20 hover:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      )}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                    </button>
                  )}
                </div>

                {hasChildren && !collapsed && isExpanded && (
                  <SidebarMenuSub className={cn(RAIL_X, RAIL_PAD, "my-1 flex gap-0.5 border-l-2 border-primary/25 py-0.5 pr-1.5")}>
                    {children.map((child) => {
                      const childActive = isChildActive(pathname, search, children, child);
                      const childDisabled = Boolean(child.disabled) || disabledFor(child.href);

                      return (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={childActive}
                            className={cn(
                              "min-h-11 gap-2.5 rounded-lg px-3 py-2",
                              "text-secondary-foreground/80 hover:bg-primary/10 hover:text-primary-foreground",
                              "data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground",
                              childDisabled && "pointer-events-none opacity-50"
                            )}
                          >
                            <Link href={childDisabled ? "#" : child.href} className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                                  childActive ? "bg-primary-foreground" : "bg-current opacity-40"
                                )}
                              />
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-semibold leading-tight">{child.label}</span>
                                {child.secondary && (
                                  <span
                                    className={cn(
                                      "truncate text-xs font-normal leading-tight text-secondary-foreground/60",
                                      childActive && "text-primary-foreground/80"
                                    )}
                                  >
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

          {groupIndex < groups.length - 1 && <SidebarSeparator className="my-3" />}
        </React.Fragment>
      ))}
    </SidebarMenu>
  );
}
