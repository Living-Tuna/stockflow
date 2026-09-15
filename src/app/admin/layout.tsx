"use client";

import { AppShell } from '@/components/layout/app-shell';
import { AppDataProvider, DataReadyGate } from '@/contexts/app-data-context';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { APP_NAME } from '@/lib/constants';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { AppBlocker } from '@/components/layout/AppBlocker';
import { CompanyRecoveryDialog } from '@/components/auth/CompanyRecoveryDialog';
import type { PaymentStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useThemeLogo } from '@/hooks/use-theme-logo';

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";
const ADMIN_ROLE = "admin";
const THEME_STORAGE_KEY = "app-color-theme";
const LOCAL_ONLY_AUTH_TOKEN = "LOCAL_ONLY_AUTH_TOKEN";
const isLocalCompanyId = (companyId?: string | null) => companyId === 'comp_local_default' || companyId?.startsWith('comp_local_');

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchCompanyProfile } = useInventoryStore();
  const { toast } = useToast();
  const themeLogo = useThemeLogo();

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [blockReason, setBlockReason] = useState<'pending' | 'expired' | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    // Apply theme on initial load
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const handleLogout = useCallback((reason: 'auth' | 'fetch_error') => {
    if (reason === 'fetch_error') {
      toast({
        variant: "destructive",
        title: "Session Error",
        description: "Could not load company profile. Logging out for security.",
      });
    }
    // Full logout logic
    localStorage.removeItem(SHARED_AUTH_TOKEN_KEY);
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('companyId');
    localStorage.removeItem('assignedStoreIds');
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('authenticatedStore_') || key === 'lastAuthenticatedStoreId') {
        sessionStorage.removeItem(key);
      }
    });
    router.replace('/');
  }, [router, toast]);

  const checkAuthAndSubscription = useCallback(async () => {
    setIsLoadingAuth(true);
    setShowRecoveryDialog(false);
    const token = localStorage.getItem(SHARED_AUTH_TOKEN_KEY);
    const userRole = localStorage.getItem('userRole');
    const companyId = localStorage.getItem('companyId');
    const dataMode = localStorage.getItem('stockflowDataMode');

    if (token === LOCAL_ONLY_AUTH_TOKEN || dataMode === 'local' || isLocalCompanyId(companyId)) {
      setIsAuthenticated(false);
      handleLogout('auth');
      setIsLoadingAuth(false);
      return;
    }

    if (token && userRole === ADMIN_ROLE && companyId) {
      const companyProfile = await fetchCompanyProfile(companyId);

      if (companyProfile) {
        setIsAuthenticated(true);
        if (companyProfile.paymentStatus === 'paid') {
          if (companyProfile.subscriptionExpiryDate && new Date(companyProfile.subscriptionExpiryDate) < new Date()) {
            setBlockReason('expired');
          } else {
            setBlockReason(null);
          }
        } else if (companyProfile.paymentStatus === 'pending') {
          if (companyProfile.creationDate) {
            const creationDate = new Date(companyProfile.creationDate);
            const trialEndDate = new Date(creationDate);
            trialEndDate.setDate(trialEndDate.getDate() + 7);

            if (new Date() < trialEndDate) {
              setBlockReason(null);
            } else {
              setBlockReason('pending');
            }
          } else {
            setBlockReason('pending');
          }
        } else {
          setBlockReason('expired');
        }
      } else {
        console.error("AdminLayout: Failed to fetch company profile for auth check. Showing recovery dialog.");
        setIsAuthenticated(false);
        setShowRecoveryDialog(true);
      }
    } else {
      setIsAuthenticated(false);
      handleLogout('auth');
    }
    setIsLoadingAuth(false);
  }, [fetchCompanyProfile, handleLogout]);

  useEffect(() => {
    if (hasMounted) {
      checkAuthAndSubscription();
    }
  }, [hasMounted, checkAuthAndSubscription]);

  const loadingScreen = (message: string) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Image
        src={themeLogo}
        alt={`${APP_NAME} Logo`}
        width={80}
        height={80}
        className="mb-8 animate-pulse"
      />
      <LoadingSpinner text={message} size={60} />
    </div>
  );

  if (!hasMounted) {
    return loadingScreen("Initializing Admin Portal...");
  }

  if (showRecoveryDialog) {
    return <CompanyRecoveryDialog isOpen={true} onOpenChange={setShowRecoveryDialog} onSuccess={checkAuthAndSubscription} />;
  }

  if (isLoadingAuth) {
    return loadingScreen("Checking authentication & subscription...");
  }

  if (blockReason) {
    return <AppBlocker reason={blockReason} />;
  }

  if (!isAuthenticated && !showRecoveryDialog) {
    return null;
  }

  return (
    <AppDataProvider>
      <DataReadyGate fallback={loadingScreen("Loading your data...")}>
        <AppShell>{children}</AppShell>
      </DataReadyGate>
    </AppDataProvider>
  );
}
