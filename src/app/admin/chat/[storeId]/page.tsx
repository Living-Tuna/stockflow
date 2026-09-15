
"use client";

import { useParams } from 'next/navigation';
import { PageTitle } from '@/components/common/page-title';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { MessageSquare, Trash2, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useEffect, useState } from 'react';
import type { Store } from '@/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function AdminStoreChatPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { 
    getStoreById, 
    clearChatForStore, 
    messagesByStore, 
    companyId: currentCompanyIdFromStoreHook // Not used directly for fetch, companyId from localStorage is used
  } = useInventoryStore((state) => ({
    getStoreById: state.getStoreById,
    clearChatForStore: state.clearChatForStore,
    messagesByStore: state.messagesByStore, // To trigger re-renders when messages update
    companyId: state.userProfile.companyName // This is not companyId, placeholder for actual id
  }));
  const { toast } = useToast();
  const { ensureStoreChatLoaded } = useAppData();

  const [store, setStore] = useState<Store | null | undefined>(undefined); // undefined for loading
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const companyIdFromStorage = localStorage.getItem('companyId');
    if (companyIdFromStorage) {
      setCurrentCompanyId(companyIdFromStorage);
    } else {
      console.error("AdminStoreChatPage: Company ID not found in localStorage.");
      toast({ variant: "destructive", title: "Error", description: "Company context is missing." });
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (storeId && currentCompanyId) {
      setIsLoading(true);
      setStore(getStoreById(storeId)); // Get store details from client cache
      ensureStoreChatLoaded(storeId, currentCompanyId).finally(() => setIsLoading(false));
    } else if (storeId && !currentCompanyId) {
      // Waiting for companyId
      setIsLoading(true);
    } else {
        setIsLoading(false);
    }
  }, [storeId, currentCompanyId, getStoreById, ensureStoreChatLoaded]);

  const handleClearChat = async () => {
    if (storeId && currentCompanyId && store) {
      const success = await clearChatForStore(storeId, currentCompanyId);
      if (success) {
        toast({
          title: "Chat Cleared",
          description: `All messages for ${store.name} have been deleted.`,
        });
      } else {
         toast({
          variant: "destructive",
          title: "Clear Failed",
          description: `Could not clear chat for ${store.name}.`,
        });
      }
    }
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading store and chat information...</div>;
  }

  if (!currentCompanyId && !isLoading) {
    return <div className="flex-1 flex items-center justify-center text-destructive">Error: Company ID missing. Cannot load chat.</div>;
  }

  if (!store && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-lg text-destructive">Store not found.</p>
        <Button asChild variant="outline">
          <Link href="/admin/chat">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Chat List
          </Link>
        </Button>
      </div>
    );
  }
  
  // Fallback if store is somehow null after loading
  if (!store) {
      return <div className="flex-1 flex items-center justify-center">Store details unavailable.</div>;
  }


  return (
    <div className="flex flex-col h-[calc(100vh_-_var(--header-height)_-_theme(spacing.12))]">
      <PageTitle 
        title={`Chat with ${store.name}`} 
        icon={MessageSquare} 
        actions={
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50">
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Chat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all chat messages for <strong>{store.name}</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat} className="bg-destructive hover:bg-destructive/90">
                    Yes, Clear Chat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/chat">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        {currentCompanyId && (
          <ChatInterface 
            storeId={store.id} 
            currentUserId="admin" 
            currentUserName="Admin" 
            // companyId={currentCompanyId} // No longer needed as prop, ChatInterface will get it
          />
        )}
      </div>
    </div>
  );
}
