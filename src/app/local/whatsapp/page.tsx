"use client";

import { WHATSAPP_ENABLED } from '@/lib/client/whatsapp-client';
import { WhatsappComingSoon } from '@/components/whatsapp/whatsapp-coming-soon';
import { WhatsappPanel } from '@/components/whatsapp/whatsapp-panel';

export default function LocalWhatsappPage() {
  if (!WHATSAPP_ENABLED) return <WhatsappComingSoon />;
  return <WhatsappPanel variant="page" />;
}