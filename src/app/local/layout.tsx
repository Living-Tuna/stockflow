
"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { APP_NAME } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { LocalAppShell } from '@/components/layout/local-app-shell';
import { AppDataProvider, DataReadyGate } from '@/contexts/app-data-context';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useThemeLogo } from '@/hooks/use-theme-logo';

const LOCAL_CREDS_KEY = "stockflow_local_creds";
const SHARED_AUTH_TOKEN_KEY = "appAuthToken";
const LOCAL_COMPANY_ID = "comp_local_default";
const LOCAL_USER_ID = "user_local_admin";

export default function LocalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState("Initializing Local Mode...");
  const fetchCompanyProfile = useInventoryStore((state) => state.fetchCompanyProfile);
  const fetchStores = useInventoryStore((state) => state.fetchStores);
  const themeLogo = useThemeLogo();

  useEffect(() => {
    const setupLocalEnv = async () => {
      try {
        setInitStatus("Checking Local Credentials...");
        let credsString = localStorage.getItem(LOCAL_CREDS_KEY);
        let creds = credsString ? JSON.parse(credsString) : null;

        if (!creds || !String(creds.companyId || '').startsWith('comp_local_')) {
          setInitStatus("Creating Local Profile...");
          creds = {
            companyId: LOCAL_COMPANY_ID,
            userId: LOCAL_USER_ID,
            userName: "Local Admin",
            companyName: "My Local Company",
          };
          localStorage.setItem(LOCAL_CREDS_KEY, JSON.stringify(creds));
        }

        setInitStatus("Opening Local Workspace...");
        localStorage.setItem(SHARED_AUTH_TOKEN_KEY, "LOCAL_ONLY_AUTH_TOKEN");
        localStorage.setItem('companyId', creds.companyId || LOCAL_COMPANY_ID);
        localStorage.setItem('userId', creds.userId || LOCAL_USER_ID);
        localStorage.setItem('userName', creds.userName || 'Local Admin');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('stockflowDataMode', 'local');

        await fetchCompanyProfile(creds.companyId || LOCAL_COMPANY_ID);
        await fetchStores(creds.companyId || LOCAL_COMPANY_ID);

        setInitStatus("Ready.");
        setIsInitializing(false);

      } catch (error) {
        console.error("Local setup error:", error);
        setInitStatus("Error setting up local mode.");
      }
    };

    setupLocalEnv();
  }, [fetchCompanyProfile, fetchStores]); // Run once on mount

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 text-center">
        <Image
          src={themeLogo}
          alt={`${APP_NAME} Logo`}
          width={80}
          height={80}
          className="mb-6 animate-pulse"
        />
        <div className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{initStatus}</span>
        </div>
      </div>
    );
  }

  return (
    <AppDataProvider>
      <DataReadyGate
        fallback={
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <Image
              src={themeLogo}
              alt={`${APP_NAME} Logo`}
              width={80}
              height={80}
              className="mb-6 animate-pulse"
            />
            <div className="flex items-center gap-2 text-lg text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading Local Data...</span>
            </div>
          </div>
        }
      >
        <LocalAppShell>{children}</LocalAppShell>
      </DataReadyGate>
    </AppDataProvider>
  );
}
