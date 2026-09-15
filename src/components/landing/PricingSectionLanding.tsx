
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS, APP_NAME, SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { CheckCircle, BadgeCheck, ArrowRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PricingSectionLanding() {
  const popularPlanId = SUBSCRIPTION_PLANS.find(p => p.isPopular)?.id || SUBSCRIPTION_PLANS[1]?.id;
  const plansToShow = SUBSCRIPTION_PLANS.filter(p => p.price !== -1);

  return (
    <section id="pricing" className="section-padding bg-tertiary dark:bg-background">
      <div className="section-container">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Flexible <span className="text-gradient-primary">Pricing Plans</span>
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground">
            Choose the plan that best fits your business needs. No hidden fees, transparent value.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3 items-stretch max-w-6xl mx-auto">
          {plansToShow.map((plan) => (
            <Card 
              key={plan.id} 
              className={cn(
                "flex flex-col transition-all duration-300 hover:shadow-2xl dark:hover:shadow-primary/20 shadow-xl rounded-2xl border border-border/70",
                plan.id === popularPlanId ? 'border-2 border-primary ring-4 ring-primary/20 relative transform scale-100 lg:scale-105' : 'hover:border-primary/50',
                plan.id !== popularPlanId ? 'bg-card' : 'bg-card', 
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
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl md:text-5xl font-extrabold text-foreground">₹{plan.price}</span>
                  <span className="text-base text-muted-foreground ml-1.5">{plan.priceSuffix}</span>
                </div>
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
          ))}
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
