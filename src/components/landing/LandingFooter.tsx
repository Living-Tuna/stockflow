
"use client";

import { APP_NAME } from '@/lib/constants';
import { useThemeLogo } from '@/hooks/use-theme-logo';
import Link from 'next/link';
import { Github, Linkedin, Twitter } from 'lucide-react'; 

export function LandingFooter() {
  const themeLogo = useThemeLogo();
  const currentYear = new Date().getFullYear();
  return (
    <footer className="section-padding pb-12 md:pb-16 border-t border-border/50 bg-muted/30 dark:bg-secondary/10">
      <div className="section-container">
        <div className="grid md:grid-cols-3 gap-10 items-center">
          <div className="flex flex-col items-center md:items-start">
             <Link href="/" className="flex items-center gap-3 mb-4 transition-opacity hover:opacity-80 group">
                <img src={themeLogo} alt={`${APP_NAME} logo`} className="h-10 w-10 rounded-lg object-contain" />
                <span className="text-3xl font-bold text-primary">{APP_NAME}</span>
            </Link>
            <p className="text-base text-muted-foreground text-center md:text-left">
              Modern inventory solutions, simplified.
            </p>
          </div>
          
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-base text-muted-foreground">
            <Link href="#features" className="hover:text-primary transition-colors duration-200 relative after:content-[''] after:absolute after:left-0 after:bottom-[-2px] after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full">Features</Link>
            <Link href="#pricing" className="hover:text-primary transition-colors duration-200 relative after:content-[''] after:absolute after:left-0 after:bottom-[-2px] after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full">Pricing</Link>
            <Link href="#contact" className="hover:text-primary transition-colors duration-200 relative after:content-[''] after:absolute after:left-0 after:bottom-[-2px] after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full">Contact</Link>
            <Link href="/admin" className="hover:text-primary transition-colors duration-200 relative after:content-[''] after:absolute after:left-0 after:bottom-[-2px] after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full">Admin Login</Link>
          </nav>

          <div className="flex justify-center md:justify-end gap-6">
            <Link href="#" aria-label="Github" className="text-muted-foreground hover:text-primary transition-transform duration-200 hover:scale-110">
              <Github className="h-7 w-7" />
            </Link>
            <Link href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-transform duration-200 hover:scale-110">
              <Linkedin className="h-7 w-7" />
            </Link>
            <Link href="#" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition-transform duration-200 hover:scale-110">
              <Twitter className="h-7 w-7" />
            </Link>
          </div>
        </div>
        <div className="mt-16 pt-10 border-t border-border/70 text-center text-sm text-muted-foreground">
          &copy; {currentYear} {APP_NAME}. All rights reserved. 
          <Link href="/privacy-policy" className="ml-4 hover:text-primary transition-colors duration-200">Privacy Policy</Link>
          <span className="mx-2 text-border">|</span>
          <Link href="/terms-of-service" className="hover:text-primary transition-colors duration-200">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}

    