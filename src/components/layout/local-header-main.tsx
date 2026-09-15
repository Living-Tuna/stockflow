
"use client";

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; 
import { Menu, UserCircle, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { LOCAL_NAV_LINKS } from './local-sidebar-nav';
import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { BrandMark } from '@/components/common/brand-mark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';

export function LocalHeaderMain() {
  const router = useRouter();

  const handleExitLocalMode = () => {
    // Optionally clear local session or just redirect
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-md">
        <div className="md:hidden">
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-border/70 hover:bg-accent">
                <>
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px] bg-sidebar text-sidebar-foreground border-r-sidebar-border">
              <SheetHeader className="p-4 border-b border-sidebar-border">
                <SheetTitle asChild>
                  <BrandMark href="/local" preferCompanyBrand showLocalBadge textClassName="text-lg" />
                </SheetTitle>
              </SheetHeader>
              <nav className="grid gap-2 text-base font-medium p-4">
                {LOCAL_NAV_LINKS.flatMap(group => group.links).map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/80 transition-colors hover:text-secondary hover:bg-sidebar-accent"
                    >
                        <link.icon className="h-5 w-5" />
                        {link.label}
                    </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

      <div className="flex w-full items-center justify-end gap-3 md:ml-auto">
        <ThemeToggle />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-10 rounded-lg hover:bg-accent focus-visible:ring-ring">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
                <span className="hidden sm:inline text-sm font-medium text-foreground truncate max-w-[150px]">
                Local User
                </span>
                <span className="sr-only">User Menu</span>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-lg">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">
                    Local User
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                    Local Mode
                </p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/local/settings" className="cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExitLocalMode} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Exit Local Mode
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
