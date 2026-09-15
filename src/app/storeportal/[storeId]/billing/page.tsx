"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { AppDataProvider, useAppData } from '@/contexts/app-data-context';
import { BillingForm } from '@/components/billing/billing-form';
import type { Store, BillMode } from '@/types';
import { PageTitle } from '@/components/common/page-title';
import { Button } from '@/components/ui/button';
import { LogOut, ShoppingCart, MessageSquare, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChatInterface } from '@/components/chat/ChatInterface';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHead,
  AlertDialogTitle as AlertDialogTit,
  AlertDialogDescription as AlertDialogDesc,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

function loadingScreen(message: string) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
      <Image src="https://placehold.co/64x64.png" alt={`${APP_NAME} Logo`} width={48} height={48} className="mb-2 rounded-lg animate-pulse" data-ai-hint="logo company" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

interface StoreBillingInnerProps {
  storeId: string;
  currentStore: Store;
  companyIdForSession: string;
  isChatDialogOpen: boolean;
  setIsChatDialogOpen: (open: boolean) => void;
  handleClearChat: () => void;
  handleStoreLogout: () => void;
  modeFromUrl: BillMode | null;
}

function StoreBillingInner({
  storeId,
  currentStore,
  companyIdForSession,
  isChatDialogOpen,
  setIsChatDialogOpen,
  handleClearChat,
  handleStoreLogout,
  modeFromUrl,
}: StoreBillingInnerProps) {
  const { ensureLoaded, ensureStoreChatLoaded, isReady } = useAppData();

  useEffect(() => {
    if (storeId && companyIdForSession) {
      ensureLoaded(['products', 'profile']);
      ensureStoreChatLoaded(storeId, companyIdForSession);
    }
  }, [storeId, companyIdForSession, ensureLoaded, ensureStoreChatLoaded]);

  if (!isReady) {
    return loadingScreen("Loading Store Data...");
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageTitle
        title={currentStore.name}
        icon={ShoppingCart}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsChatDialogOpen(true)} aria-label="Open Chat with Admin">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button variant="destructive" size="sm" onClick={handleStoreLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout Store
            </Button>
          </div>
        }
      />

      <Dialog open={isChatDialogOpen} onOpenChange={setIsChatDialogOpen}>
        <DialogContent className="sm:max-w-lg h-[70vh] p-0 flex flex-col border-t-4 border-t-primary shadow-lg">
          <DialogHeader className="p-4 border-b flex flex-row justify-between items-center">
            <DialogTitle>Chat with Admin ({currentStore.name})</DialogTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear Chat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHead>
                  <AlertDialogTit className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Are you absolutely sure?
                  </AlertDialogTit>
                  <AlertDialogDesc>
                    This action cannot be undone. This will permanently delete all chat messages for <strong>{currentStore.name}</strong>.
                  </AlertDialogDesc>
                </AlertDialogHead>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat} className="bg-destructive hover:bg-destructive/90">
                    Yes, Clear Chat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-0">
            <ChatInterface
              storeId={currentStore.id}
              currentUserId={currentStore.id}
              currentUserName={currentStore.name}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={loadingScreen("Loading Billing Interface...")}>
        <BillingForm
          key={modeFromUrl || currentStore.id}
          initialModeProp={modeFromUrl}
          storeId={currentStore.id}
          allowedModes={currentStore.allowedOperations}
          isAdminContext={false}
          companyId={companyIdForSession}
        />
      </Suspense>
    </div>
  );
}

export default function StoreBillingPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.storeId as string;
  const nextSearchParams = useNextSearchParams();
  const { toast } = useToast();

  const {
    getStoreById,
    clearChatForStore,
  } = useInventoryStore((state) => ({
    getStoreById: state.getStoreById,
    clearChatForStore: state.clearChatForStore,
  }));

  const [isStoreAuthenticated, setIsStoreAuthenticated] = useState(false);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [companyIdForSession, setCompanyIdForSession] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || !storeId) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    const authenticatedStoreSession = sessionStorage.getItem(`authenticatedStore_${storeId}`) === 'true';
    const storedCompanyId = sessionStorage.getItem(`store_${storeId}_companyId`);

    if (!authenticatedStoreSession || !storedCompanyId) {
      setIsStoreAuthenticated(false);
      router.replace(`/storeportal/${storeId}/login`);
      setIsLoading(false);
      return;
    }

    setCompanyIdForSession(storedCompanyId);
    setIsStoreAuthenticated(true);

    const store = getStoreById(storeId);
    if (store) {
      setCurrentStore(store);
      setIsLoading(false);
    } else {
      console.warn(`Store ${storeId} not found in client store after authentication.`);
      toast({ variant: "destructive", title: "Store Data Error", description: "Could not load store details. Please try logging out and in." });
      router.replace(`/storeportal/${storeId}/login`);
      setIsLoading(false);
    }
  }, [storeId, router, getStoreById, hasMounted, toast]);

  useEffect(() => {
    if (!hasMounted || isLoading || !isStoreAuthenticated || !currentStore || !storeId) {
      return;
    }

    const currentMode = nextSearchParams.get('mode') as BillMode | null;
    const allowedOps = currentStore.allowedOperations || [];

    if (allowedOps.length === 0) {
      if (!currentMode) {
        router.replace(`/storeportal/${storeId}/billing?mode=sell`);
      }
      return;
    }

    if (!currentMode) {
      router.replace(`/storeportal/${storeId}/billing?mode=${allowedOps[0]}`);
    } else if (!allowedOps.includes(currentMode)) {
      toast({ variant: "destructive", title: "Operation Not Allowed", description: `This terminal is not permitted to perform '${currentMode}' operations. Switching to default.` });
      router.replace(`/storeportal/${storeId}/billing?mode=${allowedOps[0]}`);
    }
  }, [storeId, isStoreAuthenticated, currentStore, nextSearchParams, router, hasMounted, isLoading, toast]);

  const handleStoreLogout = () => {
    if (hasMounted && storeId) {
      sessionStorage.removeItem(`authenticatedStore_${storeId}`);
      sessionStorage.removeItem('lastAuthenticatedStoreId');
      sessionStorage.removeItem(`store_${storeId}_companyId`);
    }
    setIsStoreAuthenticated(false);
    setCurrentStore(null);
    if (storeId) router.push(`/storeportal/${storeId}/login`);
    else router.push('/storeportal');
  };

  const handleClearChat = async () => {
    if (storeId && currentStore && companyIdForSession) {
      const success = await clearChatForStore(storeId, companyIdForSession);
      if (success) {
        toast({
          title: "Chat Cleared",
          description: `All messages for ${currentStore.name} have been deleted.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Clear Chat Failed",
          description: `Could not clear chat messages for ${currentStore.name}.`,
        });
      }
      setIsChatDialogOpen(false);
    }
  };

  if (!hasMounted) return loadingScreen("Initializing Store Portal...");
  if (isLoading) return loadingScreen(`Loading ${currentStore ? currentStore.name : 'Store'} Terminal...`);

  if (!currentStore && !isLoading) {
    return loadingScreen("Store not found or error loading. Redirecting...");
  }
  if (currentStore && !isStoreAuthenticated && !isLoading) {
    return loadingScreen(`Redirecting to login for ${currentStore.name}...`);
  }

  const modeFromUrl = nextSearchParams.get('mode') as BillMode | null;

  if (!currentStore || !isStoreAuthenticated || !companyIdForSession) {
    return loadingScreen("Preparing Store Terminal...");
  }

  return (
    <AppDataProvider companyId={companyIdForSession} mode="cloud" domains={['products', 'profile']}>
      <StoreBillingInner
        storeId={storeId}
        currentStore={currentStore}
        companyIdForSession={companyIdForSession}
        isChatDialogOpen={isChatDialogOpen}
        setIsChatDialogOpen={setIsChatDialogOpen}
        handleClearChat={handleClearChat}
        handleStoreLogout={handleStoreLogout}
        modeFromUrl={modeFromUrl}
      />
    </AppDataProvider>
  );
}