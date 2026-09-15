
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { Rocket, Sparkles } from 'lucide-react';

export function CallToActionSection() {
  return (
    <section className="section-padding bg-gradient-to-br from-primary via-green-600 to-secondary text-primary-foreground">
      <div className="section-container text-center">
        <div className="inline-block p-5 bg-card/20 dark:bg-primary-foreground/10 rounded-full mb-8 shadow-lg transition-all duration-300 hover:scale-110">
          <Sparkles className="h-16 w-16 text-background dark:text-primary-foreground" />
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          Ready to Transform Your Business?
        </h2>
        <p className="mt-8 max-w-2xl mx-auto text-lg md:text-xl opacity-90 leading-relaxed">
          Join hundreds of businesses streamlining their inventory and billing with {APP_NAME}.
          Sign up today and experience the difference efficiency makes.
        </p>
        <div className="mt-12">
          <Button 
            asChild 
            size="lg" 
            className="bg-card hover:bg-card/90 text-primary shadow-xl hover:shadow-2xl transition-all-fast px-12 py-7 text-xl rounded-xl group transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-card/50"
          >
            <Link href="/admin">
              Get Started Now <Rocket className="ml-3 h-6 w-6 group-hover:translate-x-1.5 group-hover:-translate-y-0.5 group-hover:rotate-[15deg] transition-transform-fast" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

    