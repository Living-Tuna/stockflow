
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, LogIn, Building, Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from '@/components/common/brand-mark';

export function StoreLoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [adminEmail, setAdminEmail] = useState('');
  const [storeUsername, setStoreUsername] = useState('');
  const [storePasskey, setStorePasskey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    // Pre-fill from query params if available
    const queryStoreId = searchParams.get('storeId');
    const queryCompanyId = searchParams.get('companyId');

    if (queryStoreId) setStoreUsername(queryStoreId); // Fallback mapping if using old links, though likely won't match username
    else {
      const lastStore = localStorage.getItem('lastStoreUsername');
      if (lastStore) setStoreUsername(lastStore);
    }

    if (queryCompanyId) setAdminEmail(queryCompanyId); // This might be wrong if query param is ID, but likely empty.
    else {
      const lastEmail = localStorage.getItem('lastAdminEmail');
      if (lastEmail) setAdminEmail(lastEmail);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMounted) return;

    if (!adminEmail.trim() || !storeUsername.trim() || !storePasskey.trim()) {
      toast({ variant: "destructive", title: "Login Failed", description: "Admin Email, Store Username, and Store Passkey are required." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginType: 'store',
          adminEmail: adminEmail.trim(),
          storeUsername: storeUsername.trim(),
          storePasskey: storePasskey,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.store) {
        sessionStorage.setItem(`authenticatedStore_${data.store.id}`, 'true');
        sessionStorage.setItem('lastAuthenticatedStoreId', data.store.id);
        sessionStorage.setItem(`store_${data.store.id}_companyId`, data.store.companyId);

        // Persist for convenience
        localStorage.setItem('lastAdminEmail', adminEmail.trim());
        localStorage.setItem('lastStoreUsername', storeUsername.trim());

        toast({
          title: "Login Successful",
          description: `Welcome to ${data.store.name} terminal.`,
        });
        router.replace(`/storeportal/${data.store.id}/billing`);
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: data.message || "Invalid credentials or server error.",
        });
      }
    } catch (error) {
      console.error("Store login error:", error);
      toast({ variant: "destructive", title: "Login Error", description: "Could not connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center mb-8">
        <BrandMark logoClassName="h-16 w-16 mb-3 animate-pulse" textClassName="text-3xl" />
        <p className="text-muted-foreground">Store Terminal Access</p>
      </div>
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Terminal Login</CardTitle>
          <CardDescription>Enter Admin Email and Store details.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adminEmail" className="flex items-center">
                <Fingerprint className="mr-2 h-4 w-4 text-muted-foreground" /> Admin Email*
              </Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                placeholder="company@admin.com"
                className="h-11"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storeUsername" className="flex items-center">
                <Building className="mr-2 h-4 w-4 text-muted-foreground" /> Store Username*
              </Label>
              <Input
                id="storeUsername"
                type="text"
                value={storeUsername}
                onChange={(e) => setStoreUsername(e.target.value)}
                required
                placeholder="e.g. main_branch"
                className="h-11"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storePasskey" className="flex items-center">
                <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" /> Store Passkey*
              </Label>
              <Input
                id="storePasskey"
                type="password"
                value={storePasskey}
                onChange={(e) => setStorePasskey(e.target.value)}
                required
                placeholder="Enter store passkey"
                className="h-11"
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full h-11 text-base" isLoading={isSubmitting}>
              <LogIn className="mr-2 h-5 w-5" />
              Access Terminal
            </Button>
            <Button variant="link" asChild className="text-xs">
              <Link href="/">Back to Main Site</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
