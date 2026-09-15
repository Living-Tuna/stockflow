
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';
import Image from 'next/image';
import { LogIn, XCircle, Mail, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { BrandLoading } from '@/components/common/brand-loading';
import { useThemeLogo } from '@/hooks/use-theme-logo';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, config: { theme?: string; size?: string; text?: string; shape?: string; width?: number }) => void;
        };
      };
    };
  }
}

interface AdminLoginEmbeddedProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
  onSwitchToSignup: () => void;
}

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";

export function AdminLoginEmbedded({ onLoginSuccess, onCancel, onSwitchToSignup }: AdminLoginEmbeddedProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { fetchCompanyProfile } = useInventoryStore();
  const themeLogo = useThemeLogo();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleGoogleCallback = useCallback(async (response: { credential: string }) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token && data.user) {
        localStorage.setItem(SHARED_AUTH_TOKEN_KEY, data.token);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name || 'Admin');
        localStorage.setItem('userRole', data.user.role || 'admin');
        localStorage.setItem('companyId', data.user.companyId);
        localStorage.setItem('userEmail', data.user.email || '');
        localStorage.setItem('stockflowDataMode', 'cloud');

        await fetchCompanyProfile(data.user.companyId);

        toast({ title: "Login Successful", description: `Welcome, ${data.user.name || 'Admin'}!` });
        onLoginSuccess();
      } else {
        toast({ variant: "destructive", title: "Google Login Failed", description: data.message || "Could not authenticate with Google." });
      }
    } catch (error) {
      console.error("Google login error:", error);
      toast({ variant: "destructive", title: "Google Login Error", description: "Could not connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchCompanyProfile, toast, onLoginSuccess]);

  useEffect(() => {
    if (!hasMounted || !googleButtonRef.current) return;

    const loadGoogleScript = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: handleGoogleCallback,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current!, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 350,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            callback: handleGoogleCallback,
          });
          window.google.accounts.id.renderButton(googleButtonRef.current!, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: 350,
          });
        }
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, [hasMounted, handleGoogleCallback]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMounted) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginType: 'admin',
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.token && data.user) {
        localStorage.setItem(SHARED_AUTH_TOKEN_KEY, data.token);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name || 'Admin');
        localStorage.setItem('userRole', data.user.role || 'admin');
        localStorage.setItem('companyId', data.user.companyId);
        localStorage.setItem('userEmail', data.user.email || '');
        localStorage.setItem('stockflowDataMode', 'cloud');

        // Fetch company profile right after successful login to populate userProfile in store
        await fetchCompanyProfile(data.user.companyId);

        toast({ title: "Login Successful", description: `Welcome, ${data.user.name || 'Admin'}!` });
        onLoginSuccess(); // This should trigger UI mode change and HomePage will redirect
      } else {
        toast({ variant: "destructive", title: "Login Failed", description: data.message || "Invalid credentials or server error." });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({ variant: "destructive", title: "Login Error", description: "Could not connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasMounted) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-muted/40 backdrop-blur-sm">
        <BrandLoading size={40} text="Loading Admin..." />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close login">
          <XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
      <div className="flex flex-col items-center mb-8">
        <Image
          src={themeLogo}
          alt={`${APP_NAME} Logo`}
          width={64}
          height={64}
          className="mb-3 rounded-lg shadow-md"
          data-ai-hint="logo company"
        />
        <h1 className="text-3xl font-bold text-primary">{APP_NAME}</h1>
        <p className="text-muted-foreground">Admin Portal</p>
      </div>
      <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Access the administration panel.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">
                <Mail className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">
                <KeyRound className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              <LogIn className="mr-2 h-5 w-5" />
              Login as Admin
            </Button>
            <div className="relative w-full flex items-center justify-center my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="relative px-2 text-xs text-muted-foreground bg-card">or continue with</span>
            </div>
            <div ref={googleButtonRef} className="w-full flex justify-center" />
            <Button variant="link" size="sm" onClick={onSwitchToSignup} className="text-xs" disabled={isSubmitting}>
              New user? Sign up
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
