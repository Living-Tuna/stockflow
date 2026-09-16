
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME, SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_IDS, EARLY_BIRD_EVENT } from '@/lib/constants';
import Image from 'next/image';
import { UserPlus, XCircle, Mail, KeyRound, Building, User as UserIcon, CreditCard, Calendar, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { BrandLoading } from '@/components/common/brand-loading';
import { LogoSpinner } from '@/components/common/logo-spinner';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SubscriptionType } from '@/types';
import type { SubscriptionPlan } from '@/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface AdminSignupEmbeddedProps {
  onSignupSuccess: () => void;
  onCancel: () => void;
  onSwitchToLogin: () => void;
}

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";

export function AdminSignupEmbedded({ onSignupSuccess, onCancel, onSwitchToLogin }: AdminSignupEmbeddedProps) {
  const { toast } = useToast();
  const { fetchCompanyProfile } = useInventoryStore(); 
  const themeLogo = useThemeLogo();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [step, setStep] = useState(1);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  
  // Step 1 state
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(SUBSCRIPTION_PLAN_IDS.GROWTH);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('monthly');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);

  const plansToShow = SUBSCRIPTION_PLANS.filter(p => p.price !== -1);

  const formatted = (value: number) => value.toLocaleString('en-IN');

  const getPlanUnitPrice = (plan: SubscriptionPlan) =>
    subscriptionType === 'monthly' ? plan.price : plan.yearlyPricePerMonth;

  const applyCode = () => {
    const code = discountCode.trim().toLowerCase();
    if (!code) {
      toast({ variant: "destructive", title: "Promo Code Required", description: "Please enter a discount code." });
      return;
    }
    if (code === EARLY_BIRD_EVENT.code.toLowerCase()) {
      setDiscountApplied(true);
      toast({ title: "Promo Applied!", description: `${EARLY_BIRD_EVENT.discountPercent}% OFF applied to all plans. Locked in for the first ${EARLY_BIRD_EVENT.totalSlots} customers.` });
    } else {
      setDiscountApplied(false);
      toast({ variant: "destructive", title: "Invalid Code", description: `This promo code is not valid. Try ${EARLY_BIRD_EVENT.code}.` });
    }
  };

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
        toast({ title: "Account Created!", description: `Welcome, ${data.user.name}! Your account is ready.` });
        
        localStorage.setItem(SHARED_AUTH_TOKEN_KEY, data.token);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name || 'Admin');
        localStorage.setItem('userRole', data.user.role || 'admin');
        localStorage.setItem('companyId', data.user.companyId);
        localStorage.setItem('userEmail', data.user.email || '');
        localStorage.setItem('stockflowDataMode', 'cloud');
        await fetchCompanyProfile(data.user.companyId);

        onSignupSuccess();
      } else {
        toast({ variant: "destructive", title: "Google Signup Failed", description: data.message || "Could not authenticate with Google." });
      }
    } catch (error) {
      console.error("Google signup error:", error);
      toast({ variant: "destructive", title: "Google Signup Error", description: "Could not connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchCompanyProfile, toast, onSignupSuccess]);

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
          text: 'signup_with',
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
            text: 'signup_with',
            shape: 'rectangular',
            width: 350,
          });
        }
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, [hasMounted, handleGoogleCallback]);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Signup Failed", description: "Passwords do not match." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Signup Failed", description: "Password must be at least 6 characters." });
      return;
    }
    if (!companyName || !adminName || !email) {
      toast({ variant: "destructive", title: "Signup Failed", description: "Please fill all required fields." });
      return;
    }
    setStep(2);
  };

  const handleFinalSignup = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName, adminName, email, password,
          planId: selectedPlanId,
          subscriptionType,
          discountCode: discountApplied && discountCode.trim().toLowerCase() === EARLY_BIRD_EVENT.code.toLowerCase() ? discountCode.trim().toLowerCase() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        toast({ title: "Account Created!", description: "Your account is ready. Payment confirmation is pending." });
        
        if (data.token) {
            localStorage.setItem(SHARED_AUTH_TOKEN_KEY, data.token);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('userName', data.user.name || 'Admin');
            localStorage.setItem('userRole', data.user.role || 'admin');
            localStorage.setItem('companyId', data.user.companyId);
            localStorage.setItem('userEmail', data.user.email || '');
            localStorage.setItem('stockflowDataMode', 'cloud');
            await fetchCompanyProfile(data.user.companyId);
        }
        onSignupSuccess(); 
      } else {
        toast({ variant: "destructive", title: "Signup Failed", description: data.message || "Could not create account." });
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast({ variant: "destructive", title: "Signup Error", description: "Could not connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderStep1 = () => (
    <div className="w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Admin Account (1/2)</CardTitle>
          <CardDescription>Set up your company and admin profile.</CardDescription>
        </CardHeader>
        <form onSubmit={handleStep1Submit}>
          <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="signup-company-name"><Building className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Company Name*</Label>
                <Input id="signup-company-name" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company LLC" required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-admin-name"><UserIcon className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Your Name (Admin)*</Label>
                <Input id="signup-admin-name" type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="John Doe" required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email"><Mail className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Admin Email*</Label>
                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourcompany.com" required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password"><KeyRound className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Password* (min. 6 characters)</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" required minLength={6} disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-confirm-password"><KeyRound className="mr-2 h-4 w-4 inline-block text-muted-foreground" /> Confirm Password*</Label>
                <Input id="signup-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required minLength={6} disabled={isSubmitting} />
              </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full">Next: Choose Plan <ArrowRight className="ml-2 h-4 w-4"/></Button>
            <div className="relative w-full flex items-center justify-center my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="relative px-2 text-xs text-muted-foreground bg-card">or continue with</span>
            </div>
            <div ref={googleButtonRef} className="w-full flex justify-center" />
            <Button variant="link" size="sm" onClick={onSwitchToLogin} className="text-xs">Already have an account? Login</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="w-full flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-primary flex flex-col">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Choose Your Plan (2/2)</CardTitle>
                <CardDescription>Select a plan and billing cycle to get started.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <RadioGroup
                    value={selectedPlanId}
                    onValueChange={setSelectedPlanId}
                    className="grid grid-cols-1 gap-4"
                >
                    {plansToShow.map(plan => {
                        const isSelected = selectedPlanId === plan.id;
                        const unitPrice = getPlanUnitPrice(plan);
                        const origUnitPrice = subscriptionType === 'monthly' ? plan.price : plan.yearlyPricePerMonth;
                        const yearlyTotal = plan.yearlyPricePerMonth * 12;
                        return (
                            <Label
                                key={plan.id}
                                htmlFor={plan.id}
                                className={cn(
                                    "flex flex-col md:flex-row items-start md:items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-all",
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-border hover:border-muted-foreground/50"
                                )}
                            >
                                <RadioGroupItem value={plan.id} id={plan.id} className="h-5 w-5 mt-1 md:mt-0 shrink-0" />
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-1">
                                        <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                                        <div className="text-lg font-bold text-primary">
                                            {discountApplied && (
                                                <span className="text-sm font-normal text-muted-foreground line-through mr-2">
                                                    ₹{formatted(origUnitPrice)}
                                                </span>
                                            )}
                                            ₹{formatted(discountApplied ? Math.round(unitPrice * 0.5) : unitPrice)}
                                            <span className="text-sm font-normal text-muted-foreground">{plan.priceSuffix}</span>
                                            <div className="text-xs font-normal text-muted-foreground mt-0.5">
                                                {subscriptionType === 'yearly'
                                                    ? `Billed ₹${formatted(discountApplied ? Math.round(yearlyTotal * 0.5) : yearlyTotal)} / year`
                                                    : 'Billed monthly'}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {
                                            plan.id === SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY ? "For single users needing core billing and inventory, without staff/store features." :
                                            plan.id === SUBSCRIPTION_PLAN_IDS.STARTER ? "Perfect for new businesses getting started." :
                                            plan.id === SUBSCRIPTION_PLAN_IDS.GROWTH ? "Ideal for growing businesses needing more capacity." :
                                            "For established businesses scaling operations."
                                        }
                                    </p>
                                </div>
                            </Label>
                        )
                    })}
                </RadioGroup>

                <div className="pt-4 border-t">
                    <Label className="font-semibold text-center block mb-3">Select Billing Cycle</Label>
                    <RadioGroup
                        value={subscriptionType}
                        onValueChange={(v) => setSubscriptionType(v as SubscriptionType)}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                        <Label htmlFor="monthly-cycle" className={cn("text-center p-4 border rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all", subscriptionType === 'monthly' && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                            <RadioGroupItem value="monthly" id="monthly-cycle" />
                            <div className="flex flex-col items-center">
                                <span className="font-medium">Monthly</span>
                                <span className="text-xs text-muted-foreground">Billed every month</span>
                            </div>
                        </Label>
                        <Label htmlFor="yearly-cycle" className={cn("text-center p-4 border rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all", subscriptionType === 'yearly' && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                            <RadioGroupItem value="yearly" id="yearly-cycle" />
                            <div className="flex flex-col items-center">
                                <span className="font-medium">Yearly</span>
                                <span className="text-xs text-primary">Save up to 20%</span>
                            </div>
                        </Label>
                    </RadioGroup>
                </div>

                <div className="pt-4 border-t">
                    <Label className="font-semibold block mb-2">Promo Code</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            type="text"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value)}
                            placeholder={`Enter code e.g. ${EARLY_BIRD_EVENT.code}`}
                            disabled={discountApplied}
                            className="flex-1"
                        />
                        <Button type="button" variant={discountApplied ? "outline" : "default"} onClick={applyCode} disabled={discountApplied || isSubmitting}>
                            {discountApplied ? 'Applied' : 'Apply'}
                        </Button>
                    </div>
                    {discountApplied ? (
                        <p className="text-xs text-green-600 mt-2 font-semibold">
                            {EARLY_BIRD_EVENT.discountPercent}% OFF applied! Your discounted prices are shown above.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground mt-2">
                            Use <code className="font-mono font-bold text-primary">{EARLY_BIRD_EVENT.code}</code> to get {EARLY_BIRD_EVENT.discountPercent}% OFF. Limited to the first {EARLY_BIRD_EVENT.totalSlots} customers.
                        </p>
                    )}
                </div>

                <div className="text-center p-3 bg-tertiary rounded-md text-sm text-tertiary-foreground">
                    <p className="font-semibold">Manual Payment Process</p>
                    <p className="text-xs">After registration, your account is pending. Our team will contact you to complete the payment.</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
                <Button onClick={handleFinalSignup} disabled={isSubmitting}>
                    {isSubmitting ? <LogoSpinner size={16} className="mr-2" alt="" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Complete Signup
                </Button>
            </CardFooter>
        </Card>
    </div>
  );

  if (!hasMounted) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-muted/40 backdrop-blur-sm">
            <BrandLoading size={40} text="Loading Admin Signup..." />
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-start justify-start p-4 bg-background/90 backdrop-blur-sm overflow-y-auto">
      <div className="absolute top-4 right-4 z-10">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close signup"><XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" /></Button>
      </div>
      <div className="w-full flex flex-col items-center pt-8 pb-6">
        <Image src={themeLogo} alt={`${APP_NAME} Logo`} width={64} height={64} className="mb-3 rounded-lg shadow-md" />
        <h1 className="text-3xl font-bold text-primary">{APP_NAME}</h1>
        <p className="text-muted-foreground">Admin & Company Registration</p>
      </div>
      {step === 1 ? renderStep1() : renderStep2()}
      <div className="w-full h-8 flex-shrink-0"></div>
    </div>
  );
}
