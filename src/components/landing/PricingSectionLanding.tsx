"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_IDS, EARLY_BIRD_EVENT } from '@/lib/constants';
import { CheckCircle, ArrowRight, Star, Timer, BadgePercent, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

type BillingCycle = 'monthly' | 'yearly';

interface EarlyBirdStatus {
  code: string;
  discountPercent: number;
  totalSlots: number;
  slotsLeft: number;
  expiresAt: string;
  isActive: boolean;
}

const FALLBACK_STATUS: EarlyBirdStatus = {
  code: EARLY_BIRD_EVENT.code,
  discountPercent: EARLY_BIRD_EVENT.discountPercent,
  totalSlots: EARLY_BIRD_EVENT.totalSlots,
  slotsLeft: EARLY_BIRD_EVENT.totalSlots,
  expiresAt: EARLY_BIRD_EVENT.expiresAt,
  isActive: true,
};

const formatNumber = (value: number): string => value.toLocaleString('en-IN');

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function PricingSectionLanding() {
  const popularPlanId = SUBSCRIPTION_PLANS.find(p => p.isPopular)?.id || SUBSCRIPTION_PLANS[1]?.id;
  const plansToShow = SUBSCRIPTION_PLANS.filter(p => p.price !== -1);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [earlyBird, setEarlyBird] = useState<EarlyBirdStatus>(FALLBACK_STATUS);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/earlybird/status')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success) {
          setEarlyBird({ ...FALLBACK_STATUS, ...data });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const showCyclePrice = (planId: string) => billingCycle === 'yearly' && planId !== SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY;
  const hasYearlyDiscount = billingCycle === 'yearly';
  const usedSlots = earlyBird.totalSlots - earlyBird.slotsLeft;
  const slotsPercent = Math.min(100, Math.round((usedSlots / earlyBird.totalSlots) * 100));

  return (
    <section id="pricing" className="section-padding bg-tertiary dark:bg-background">
      <div className="section-container">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Flexible <span className="text-gradient-primary">Pricing Plans</span>
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground">
            Choose the plan that best fits your business needs. No hidden fees, transparent value.
          </p>
        </div>

        {earlyBird.isActive && (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 shadow-xl">
              <div className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex items-center justify-center bg-primary text-primary-foreground rounded-xl p-3 shadow-lg">
                    <BadgePercent className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                        <Timer className="h-3.5 w-3.5" /> Early Bird Offer
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                        <Ticket className="h-3.5 w-3.5" /> Code: {earlyBird.code}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-foreground">
                      Get {earlyBird.discountPercent}% OFF on any plan
                    </h3>
                    <p className="mt-2 text-base text-muted-foreground">
                      Valid for the first {formatNumber(earlyBird.totalSlots)} customers only. Apply code{' '}
                      <code className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{earlyBird.code}</code>{' '}
                      at signup.
                    </p>
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground">
                          {formatNumber(earlyBird.slotsLeft)} of {formatNumber(earlyBird.totalSlots)} slots left
                        </span>
                        <span className="text-muted-foreground">Expires {formatDate(earlyBird.expiresAt)}</span>
                      </div>
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-green-600 rounded-full transition-all duration-700"
                          style={{ width: `${slotsPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center rounded-xl bg-muted p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all-fast",
                billingCycle === 'monthly' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all-fast",
                billingCycle === 'yearly' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              {billingCycle === 'yearly' && (
                <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded">SAVE ~20%</span>
              )}
            </button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3 items-stretch max-w-6xl mx-auto">
          {plansToShow.map((plan) => {
            const yearlyPerMonth = plan.yearlyPricePerMonth;
            const yearlyTotal = yearlyPerMonth * 12;
            const savings = Math.round(((plan.price - yearlyPerMonth) / plan.price) * 100);
            const showYearly = hasYearlyDiscount && yearlyPerMonth >= 0;
            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col transition-all duration-300 hover:shadow-2xl dark:hover:shadow-primary/20 shadow-xl rounded-2xl border border-border/70",
                  plan.id === popularPlanId ? 'border-2 border-primary ring-4 ring-primary/20 relative transform scale-100 lg:scale-105' : 'hover:border-primary/50',
                  'bg-card',
                  "group"
                )}
              >
                {plan.id === popularPlanId && (
                  <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground p-2.5 rounded-full shadow-lg z-10 animate-pulse-badge">
                    <Star className="h-6 w-6 fill-current" />
                  </div>
                )}
                <CardHeader className="pb-6 pt-10 px-8 text-center">
                  <CardTitle className={cn(
                    "text-2xl md:text-3xl font-bold mb-3",
                    plan.id === popularPlanId ? "text-primary" : "text-foreground"
                  )}>
                    {plan.name}
                  </CardTitle>
                  {showCyclePrice(plan.id) ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl md:text-5xl font-extrabold text-foreground">₹{formatNumber(yearlyPerMonth)}</span>
                        <span className="text-base text-muted-foreground ml-1.5">/ month</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">₹{formatNumber(plan.price)}/mo</span>
                        <span className="text-xs font-bold text-green-600 bg-green-600/10 px-2 py-0.5 rounded-full">Save {savings}%</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Billed <span className="font-semibold text-foreground">₹{formatNumber(yearlyPerMonth)} × 12</span> ={' '}
                        <span className="font-semibold text-foreground">₹{formatNumber(yearlyTotal)}/year</span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl md:text-5xl font-extrabold text-foreground">₹{formatNumber(plan.price)}</span>
                      <span className="text-base text-muted-foreground ml-1.5">{plan.priceSuffix}</span>
                    </div>
                  )}
                  <CardDescription className="text-sm text-muted-foreground h-12 pt-2">
                    {plan.id === SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY ? "For single users needing core features without staff/store management." :
                     plan.name === 'Starter' ? "Perfect for new businesses and solo entrepreneurs ready to organize." :
                     plan.name === 'Growth' ? "Ideal for growing businesses needing more capacity and robust features." :
                     "For established businesses aiming to scale operations efficiently." }
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 pt-0 px-8">
                  <ul className="space-y-3.5 text-base text-muted-foreground">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle className="h-5 w-5 mr-3 mt-0.5 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 mt-auto">
                  <Button
                    asChild
                    className={cn(
                      "w-full text-base py-3.5 rounded-xl group transition-all-fast transform hover:scale-105 focus:scale-105",
                      plan.id === popularPlanId ? "bg-primary hover:bg-primary/85 text-primary-foreground shadow-lg hover:shadow-primary/50" : "bg-secondary hover:bg-secondary/85 text-secondary-foreground shadow-md hover:shadow-lg"
                    )}
                    size="lg"
                  >
                    <Link href="/admin">
                      Get Started <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform-fast" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        <div className="mt-20 text-center">
          <p className="text-muted-foreground text-lg">
            Need more? We offer an <Link href="#contact" className="text-primary hover:underline font-semibold transition-colors">Enterprise plan</Link> with custom solutions.
          </p>
        </div>
      </div>
    </section>
  );
}