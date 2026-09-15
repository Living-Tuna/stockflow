
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { LogIn, Building, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useThemeLogo } from '@/hooks/use-theme-logo';

interface HeroSectionProps {
  onAdminLoginClick: () => void;
  onStoreLoginClick: () => void;
}

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";

export function HeroSection({ onAdminLoginClick, onStoreLoginClick }: HeroSectionProps) {
  const router = useRouter();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const themeLogo = useThemeLogo();

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(SHARED_AUTH_TOKEN_KEY);
      const role = localStorage.getItem('userRole');
      setIsAdminLoggedIn(!!token && role === 'admin');
    }
  }, []);

  const handleAdminAccessClick = () => {
    if (isAdminLoggedIn) {
      router.push('/admin');
    } else {
      onAdminLoginClick();
    }
  };

  if (!hasMounted) {
    return (
      <section className="relative section-padding bg-gradient-to-br from-primary/5 via-background to-background/0 overflow-hidden min-h-[70vh] flex items-center">
        <div className="section-container text-center">
          <div className="animate-pulse">
            <div className="h-36 w-36 bg-muted rounded-3xl mx-auto mb-10 shadow-2xl"></div>
            <div className="h-16 bg-muted rounded-lg w-4/5 mx-auto mb-8"></div>
            <div className="h-12 bg-muted rounded-lg w-3/5 mx-auto mb-12"></div>
            <div className="flex flex-col sm:flex-row justify-center gap-5 md:gap-8">
              <div className="h-16 bg-muted rounded-xl w-72"></div>
              <div className="h-16 bg-muted rounded-xl w-72"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative section-padding bg-gradient-to-br from-primary/5 via-background to-background/0 overflow-hidden min-h-[70vh] flex items-center">
      <div className="absolute inset-0 opacity-15 dark:opacity-10">
        <div className="absolute top-0 left-0 w-80 h-80 md:w-96 md:h-96 bg-primary/20 dark:bg-primary/15 rounded-full -translate-x-1/3 -translate-y-1/4 blur-3xl pointer-events-none animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 md:w-96 md:h-96 bg-secondary/20 dark:bg-secondary/15 rounded-full translate-x-1/3 translate-y-1/4 blur-3xl pointer-events-none animate-pulse-slow delay-200"></div>
      </div>
      <div className="section-container text-center relative z-10">
        <div className="flex flex-col items-center mb-12 md:mb-16">
          <div className="mb-10 transform transition-transform duration-500 hover:scale-105">
            <Image
              src={themeLogo}
              alt={`${APP_NAME} Logo`}
              width={160}
              height={160}
              className="bg-background"
              priority
            />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-foreground">
            Intelligent Inventory and Billing from Del<span className="text-gradient-primary">V</span>are
          </h1>
          <p className="mt-8 max-w-3xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            The ultimate solution for modern inventory management, seamless billing, staff, and multi-store operations. Streamline with efficiency and insight, beautifully.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-5 md:gap-8">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/85 text-primary-foreground shadow-lg hover:shadow-primary/40 transition-all-fast px-12 py-7 text-xl rounded-xl group transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-primary/30"
            onClick={handleAdminAccessClick}
          >
            {isAdminLoggedIn ? 'Go to Admin Dashboard' : 'Admin Access'}
            <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1.5 transition-transform-fast" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="shadow-md hover:shadow-lg transition-all-fast border-secondary/50 hover:border-secondary text-secondary hover:bg-secondary/10 px-12 py-7 text-xl rounded-xl group transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-secondary/30"
            onClick={onStoreLoginClick}
          >
            <Building className="mr-3 h-6 w-6" /> Store Terminal
            <ArrowRight className="ml-2.5 h-5 w-5 text-secondary/70 group-hover:translate-x-1 transition-transform-fast" />
          </Button>
        </div>
        <p className="mt-16 text-base text-muted-foreground flex items-center justify-center gap-2">
          <ShieldCheck size={18} className="text-green-500" /> Empowering businesses with intuitive tools for <span className="font-semibold text-foreground">sustainable growth</span>.
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          Try demo{' '}
          <Link href="/local" className="font-medium text-primary hover:underline">
            Click here
          </Link>
        </p>
      </div>

      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.12; transform: scale(1.03); }
        }
        .animate-pulse-slow { animation: pulse-slow 10s infinite ease-in-out; }
        .animate-pulse-slow.delay-200 { animation-delay: 2.5s; }
      `}</style>
    </section>
  );
}
