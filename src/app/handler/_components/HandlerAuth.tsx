"use client";

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { verifyHandlerAccess } from '../actions';
import { CustomerList } from './CustomerList';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import Link from 'next/link';

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";

export function HandlerAuth() {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'denied' | 'not_signed_in'>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem(SHARED_AUTH_TOKEN_KEY);
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    if (!token || userRole !== 'admin' || !userId) {
      setStatus('not_signed_in');
      return;
    }

    startTransition(async () => {
      const result = await verifyHandlerAccess(userId);
      if (result.success) {
        setStatus('authorized');
      } else {
        setErrorMessage(result.error || 'Access denied.');
        setStatus('denied');
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: result.error,
        });
      }
    });
  }, [toast]);

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center p-12 bg-card rounded-lg shadow-md">
        <LoadingSpinner text="Verifying handler access..." />
      </div>
    );
  }

  if (status === 'authorized') {
    return <CustomerList />;
  }

  if (status === 'not_signed_in') {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-card rounded-lg shadow-lg border-t-4 border-amber-500 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-2xl font-bold">Sign In Required</h2>
        <p className="text-muted-foreground text-sm">
          The Subscription Handler is restricted to the owner account. Please sign in as the authorized admin first.
        </p>
        <div className="flex justify-center">
          {isPending ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Button asChild>
              <Link href="/">
                <LogIn className="mr-2 h-4 w-4" /> Go to Sign In
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-card rounded-lg shadow-lg border-t-4 border-red-500 text-center space-y-4">
      <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
      <h2 className="text-2xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground text-sm">{errorMessage}</p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/">Go to Admin Login</Link>
        </Button>
      </div>
    </div>
  );
}