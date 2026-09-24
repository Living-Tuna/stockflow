"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WhatsappCampaign,
  WhatsappConnectionState,
  WhatsappContact,
  WhatsappMessage,
} from '@/types';

export interface WhatsappStatus {
  status: WhatsappConnectionState;
  connected: boolean;
  qr?: string | null;
  phone?: string | null;
  lastError?: string | null;
  autoSendBill?: boolean;
}

const AUTOSEND_LOCAL_KEY = 'stockflow:whatsapp:autosend';
const sessionKey = (companyId: string) => `stockflow:whatsapp:session:${companyId}`;

export function readAutoSendFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTOSEND_LOCAL_KEY) === '1';
}

export function writeAutoSendFlag(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTOSEND_LOCAL_KEY, enabled ? '1' : '0');
}

// The server keeps the WhatsApp session in memory only; the browser is the
// durable store. These helpers read/write/clear the cached session so it can be
// re-uploaded on connect (rehydrates without re-scanning the QR).
function readSession(companyId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(sessionKey(companyId));
  } catch {
    return null;
  }
}

function writeSession(companyId: string, session: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(sessionKey(companyId), session);
  } catch { /* quota/private mode — connection still works, just won't persist */ }
}

function removeSession(companyId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(sessionKey(companyId));
  } catch { /* ignore */ }
}

export interface UseWhatsAppOptions {
  companyId?: string | null;
  poll?: boolean;
}

async function raw<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; message?: string; data?: any }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json().catch(() => ({}));
    return { ok: !!json?.success, message: json?.message, data: json?.data };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Network error' };
  }
}

export function useWhatsApp(options: UseWhatsAppOptions = {}) {
  const companyId = options.companyId ?? (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null);
  const [status, setStatus] = useState<WhatsappStatus>({ status: 'idle', connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState<WhatsappContact[]>([]);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsappCampaign[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const pollingRef = useRef(false);
  const statusRef = useRef<WhatsappStatus>(status);
  statusRef.current = status;
  const rehydratedRef = useRef(false);
  const persistedRef = useRef(false);
  const connectRef = useRef<() => Promise<any>>(async () => {});

  const persistSession = useCallback(async (id: string) => {
    const r = await raw(`/api/whatsapp/session?companyId=${encodeURIComponent(id)}`);
    if (r.ok && typeof r.data?.session === 'string' && r.data.session) {
      writeSession(id, r.data.session);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!companyId) return;
    const r = await raw(`/api/whatsapp/status?companyId=${encodeURIComponent(companyId)}`);
    if (r.ok && r.data) {
      const next = r.data as WhatsappStatus;
      setStatus(next);
      if (next.autoSendBill !== undefined) writeAutoSendFlag(!!next.autoSendBill);
      if (next.status === 'connected' && !persistedRef.current) {
        persistedRef.current = true;
        void persistSession(companyId);
      } else if (next.status === 'qr') {
        // Server needs a fresh scan — any cached session is stale/useless.
        removeSession(companyId);
      }
    }
    setIsLoading(false);
  }, [companyId, persistSession]);

  const refreshContacts = useCallback(async (search?: string) => {
    if (!companyId) return;
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    const r = await raw(`/api/whatsapp/contacts?companyId=${encodeURIComponent(companyId)}${q}`);
    if (r.ok && Array.isArray(r.data)) setContacts(r.data);
  }, [companyId]);

  const refreshCampaigns = useCallback(async () => {
    if (!companyId) return;
    const r = await raw(`/api/whatsapp/campaigns?companyId=${encodeURIComponent(companyId)}`);
    if (r.ok && Array.isArray(r.data)) setCampaigns(r.data);
  }, [companyId]);

  // Status polling: fast while awaiting a QR scan, slow otherwise.
  useEffect(() => {
    if (options.poll === false || !companyId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await fetchStatus();
      if (cancelled) return;
      const st = statusRef.current.status;
      // Cold server (restart / shared host): the engine has no live socket, but
      // we may hold a cached session in the browser. Re-upload it once to
      // reconnect without forcing a QR re-scan.
      if (
        !rehydratedRef.current &&
        readSession(companyId) &&
        (st === 'idle' || st === 'disconnected')
      ) {
        rehydratedRef.current = true;
        void connectRef.current?.();
      }
      const delayMs = st === 'qr' || st === 'connecting' ? 1800 : 5000;
      timer = setTimeout(tick, delayMs);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, options.poll, fetchStatus]);

  useEffect(() => {
    if (companyId) refreshContacts();
    if (companyId) void refreshCampaigns();
  }, [companyId, refreshContacts, refreshCampaigns]);

  const connect = useCallback(async () => {
    if (!companyId) return { ok: false as const, message: 'No company selected.' };
    setStatus((s) => ({ ...s, status: 'connecting', lastError: null }));
    const r = await raw('/api/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify({ companyId, session: readSession(companyId) || null }),
    });
    setStatus((s) => ({ ...s, ...(r.data || {}), ...(r.ok ? {} : { lastError: r.message }), status: r.data?.status || s.status }));
    if (r.data?.status === 'disconnected') {
      // Rehydrated creds were rejected (logged out / session expired) — drop the
      // stale cache so the next connect starts a fresh QR flow.
      removeSession(companyId);
    }
    void fetchStatus();
    return r;
  }, [companyId, fetchStatus]);
  connectRef.current = connect;

  const logout = useCallback(async () => {
    if (!companyId) return;
    await raw('/api/whatsapp/logout', { method: 'POST', body: JSON.stringify({ companyId }) });
    removeSession(companyId);
    rehydratedRef.current = false;
    persistedRef.current = false;
    void fetchStatus();
  }, [companyId, fetchStatus]);

  const sendMessage = useCallback(async (phone: string, text: string) => {
    if (!companyId) return { ok: false as const, message: 'No company selected.' };
    const r = await raw('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ companyId, phone, text }),
    });
    if (r.ok) {
      void refreshContacts();
      if (activePhone) await loadMessages(activePhone);
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, refreshContacts, activePhone]);

  const sendBill = useCallback(async (billId: string) => {
    if (!companyId) return { ok: false as const, message: 'No company selected.' };
    const r = await raw('/api/whatsapp/send-bill', {
      method: 'POST',
      body: JSON.stringify({ companyId, billId }),
    });
    if (r.ok) {
      void refreshContacts();
      if (activePhone) await loadMessages(activePhone);
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, refreshContacts, activePhone]);

  const toggleAutoSend = useCallback(async (enabled: boolean) => {
    writeAutoSendFlag(enabled);
    setStatus((s) => ({ ...s, autoSendBill: enabled }));
    if (!companyId) return;
    await raw('/api/whatsapp/auto-send', {
      method: 'POST',
      body: JSON.stringify({ companyId, enabled }),
    });
  }, [companyId]);

  const loadMessages = useCallback(async (phone: string) => {
    if (!companyId) return;
    const r = await raw(`/api/whatsapp/messages?companyId=${encodeURIComponent(companyId)}&phone=${encodeURIComponent(phone)}`);
    if (r.ok && Array.isArray(r.data)) {
      setMessages(r.data);
      setActivePhone(phone);
    }
  }, [companyId]);

  const createCampaign = useCallback(async (name: string, message: string, audience: WhatsappCampaign['audience']) => {
    if (!companyId) return { ok: false as const, message: 'No company selected.' };
    const r = await raw('/api/whatsapp/campaigns', {
      method: 'POST',
      body: JSON.stringify({ companyId, name, message, audience }),
    });
    if (r.ok) void refreshCampaigns();
    return r;
  }, [companyId, refreshCampaigns]);

  const runCampaign = useCallback(async (campaignId: string) => {
    if (!companyId) return { ok: false as const, message: 'No company selected.' };
    const r = await raw(`/api/whatsapp/campaigns/${campaignId}/send`, {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    void refreshCampaigns();
    return r;
  }, [companyId, refreshCampaigns]);

  const getContactName = useCallback((phone: string) => contacts.find((c) => c.phone === phone)?.name || phone.slice(-10), [contacts]);

  return {
    companyId,
    status,
    isLoading,
    contacts,
    messages,
    campaigns,
    activePhone,
    fetchStatus,
    refreshContacts,
    connect,
    logout,
    sendMessage,
    sendBill,
    toggleAutoSend,
    loadMessages,
    createCampaign,
    runCampaign,
    getContactName,
  };
}