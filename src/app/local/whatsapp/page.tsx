"use client";

import { PageTitle } from '@/components/common/page-title';
import { WhatsappPanel } from '@/components/whatsapp/whatsapp-panel';
import { MessageCircle } from 'lucide-react';

export default function LocalWhatsappPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <PageTitle title="WhatsApp" icon={MessageCircle} />
        <p className="text-sm text-muted-foreground">
          Link your WhatsApp to send bills and run customer campaigns.
        </p>
      </header>
      <div className="h-[calc(100vh-10rem)] min-h-[480px]">
        <WhatsappPanel variant="page" />
      </div>
    </div>
  );
}