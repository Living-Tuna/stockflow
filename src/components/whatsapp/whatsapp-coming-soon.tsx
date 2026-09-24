"use client";

import { PageTitle } from '@/components/common/page-title';
import { MessageCircle, Sparkles } from 'lucide-react';

export function WhatsappComingSoon() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <PageTitle title="WhatsApp" icon={MessageCircle} />
        <p className="text-sm text-muted-foreground">
          Link your WhatsApp to send bills and run customer campaigns.
        </p>
      </header>
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          WhatsApp messaging is on the roadmap. Once it ships, you&apos;ll be able to
          link a WhatsApp number, send bills straight to customers, and run
          promotional campaigns from here.
        </p>
      </div>
    </div>
  );
}