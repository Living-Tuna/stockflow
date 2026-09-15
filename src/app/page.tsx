
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { PricingSectionLanding } from '@/components/landing/PricingSectionLanding';
import { OtherSection } from '@/components/landing/OtherSection';
import { ContactSection } from '@/components/landing/ContactSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { CallToActionSection } from '@/components/landing/CallToActionSection';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { AdminLoginEmbedded } from '@/components/auth/AdminLoginEmbedded';
import { AdminSignupEmbedded } from '@/components/auth/AdminSignupEmbedded';
import { BrandLoading } from '@/components/common/brand-loading';

type UIMode = 'landing' | 'adminLogin' | 'adminSignup';

const SHARED_AUTH_TOKEN_KEY = "appAuthToken";
const ADMIN_ROLE = "admin";

export default function HomePage() {
  const router = useRouter();
  const [uiMode, setUiMode] = useState<UIMode>('landing');
  const [hasMounted, setHasMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      const adminToken = localStorage.getItem(SHARED_AUTH_TOKEN_KEY);
      const adminRole = localStorage.getItem('userRole');
      const lastAuthStoreId = sessionStorage.getItem('lastAuthenticatedStoreId');
      const isStoreStillAuthenticated = lastAuthStoreId && sessionStorage.getItem(`authenticatedStore_${lastAuthStoreId}`) === 'true';

      let redirected = false;
      if (adminToken && adminRole === ADMIN_ROLE) {
        router.replace('/admin');
        redirected = true;
      } else if (isStoreStillAuthenticated && lastAuthStoreId) {
        router.replace(`/storeportal/${lastAuthStoreId}/billing`);
        redirected = true;
      } else {
        if (lastAuthStoreId) sessionStorage.removeItem('lastAuthenticatedStoreId');
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('authenticatedStore_')) {
            sessionStorage.removeItem(key);
          }
        });
      }

      setIsRedirecting(false);

      if (!redirected && uiMode !== 'adminLogin' && uiMode !== 'adminSignup') {
        setUiMode('landing');
      }
    }
  }, [hasMounted, router, uiMode]);


  const showAdminLogin = () => setUiMode('adminLogin');
  const showAdminSignup = () => setUiMode('adminSignup');
  const hideAuthFormsAndRecheck = () => {
    setUiMode('landing');
    setIsRedirecting(true);
  };


  if (!hasMounted || isRedirecting) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <BrandLoading size={88} text="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {uiMode === 'landing' && (
        <>
          <LandingHeader onAdminLoginClick={showAdminLogin} onStoreLoginClick={() => router.push('/storeportal')} />
          <main className="flex-grow">
            <HeroSection onAdminLoginClick={showAdminLogin} onStoreLoginClick={() => router.push('/storeportal')} />
            <DownloadSection />
            <FeaturesSection />
            <PricingSectionLanding />
            <OtherSection />
            <CallToActionSection />
            <ContactSection />
          </main>
          <LandingFooter />
        </>
      )}

      {uiMode === 'adminLogin' && (
        <AdminLoginEmbedded
          onLoginSuccess={hideAuthFormsAndRecheck}
          onCancel={() => setUiMode('landing')}
          onSwitchToSignup={showAdminSignup}
        />
      )}

      {uiMode === 'adminSignup' && (
        <AdminSignupEmbedded
          onSignupSuccess={hideAuthFormsAndRecheck}
          onCancel={() => setUiMode('landing')}
          onSwitchToLogin={showAdminLogin}
        />
      )}
    </div>
  );
}
