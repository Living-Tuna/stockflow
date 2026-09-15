
"use client";

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; 
import { Menu, UserCircle, LogOut, Settings as SettingsIcon, User as UserIcon, ChevronDown } from 'lucide-react';
import { NAV_LINK_GROUPS } from '@/lib/constants';
import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/common/brand-mark';

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";

export function HeaderMain() {
  const router = useRouter();
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  const updateAuthState = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(SHARED_AUTH_TOKEN_KEY);
      const name = localStorage.getItem('userName');
      const role = localStorage.getItem('userRole');
      setIsUserLoggedIn(!!token); 
      setUserName(name);
      setUserRole(role);
    }
  };

  useEffect(() => {
    setHasMounted(true);
    updateAuthState();
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    const handleStorageChange = () => {
      updateAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange); 

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, [hasMounted]);


  const handleLogout = () => {
    localStorage.removeItem(SHARED_AUTH_TOKEN_KEY);
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('companyId');
    localStorage.removeItem('assignedStoreIds');
    sessionStorage.removeItem('lastAuthenticatedStoreId');

    setIsUserLoggedIn(false);
    setUserName(null);
    setUserRole(null);

    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('authenticatedStore_')) {
        sessionStorage.removeItem(key);
      }
    });
    router.push('/');
  };


  if (!hasMounted) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-md">
        <div className="flex w-full items-center justify-end gap-2 md:ml-auto">
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
        </div>
      </header>
    );
  }


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
            <SheetContent side="left" className="flex flex-col p-0 w-[280px] bg-secondary text-secondary-foreground border-r border-border">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle asChild>
                  <BrandMark href={userRole === 'admin' ? "/admin" : "/"} preferCompanyBrand textClassName="text-lg" />
                </SheetTitle>
              </SheetHeader>
              <nav className="grid gap-2 text-base font-medium p-4">
                {userRole === 'admin' && NAV_LINK_GROUPS.flatMap(group => group.links).map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-secondary-foreground/80 transition-colors hover:text-primary-foreground hover:bg-primary/10"
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
        {isUserLoggedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-10 rounded-lg hover:bg-accent focus-visible:ring-ring">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
                <span className="hidden sm:inline text-sm font-medium text-foreground truncate max-w-[150px]">
                  {userName || (userRole === 'admin' ? 'Admin' : 'User')}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground opacity-70 hidden sm:inline"/>
                <span className="sr-only">User Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-lg">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {userName || (userRole === 'admin' ? 'Administrator' : 'User Account')}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Role'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userRole === 'admin' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/profile" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings" className="cursor-pointer">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary">
            <Link href="/">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
