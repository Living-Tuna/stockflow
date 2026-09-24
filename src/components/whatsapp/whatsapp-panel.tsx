"use client";

import React, { useMemo, useRef, useState } from 'react';
import { useWhatsApp } from '@/hooks/use-whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { LogoSpinner } from '@/components/common/logo-spinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  MessageCircle, X, Power, Search, Send, UserPlus, Megaphone, Settings as SettingsIcon,
  CheckCircle2, AlertCircle, Wifi, WifiOff, RotateCcw, LogOut, Phone as PhoneIcon,
} from 'lucide-react';
import type { WhatsappContact, WhatsappCampaign } from '@/types';

interface WhatsappPanelProps {
  variant?: 'page' | 'popup';
  onClose?: () => void;
}

const AUDIENCE_LABELS: Record<WhatsappCampaign['audience'], string> = {
  all: 'All contacts',
  with_bills: 'Customers with bills',
  recent: 'Active in last 60 days',
  spenders: 'High spenders',
};

function fmtPhone(p: string): string {
  if (p.length === 12 && p.startsWith('91')) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  return p;
}

function fmtTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  if (now - ts < 24 * 3600 * 1000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function StatusChip({ connected, status }: { connected: boolean; status: string }) {
  if (connected) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  }
  if (status === 'qr' || status === 'connecting') {
    return (
      <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
        <Wifi className="h-3 w-3 animate-pulse" /> Scan required
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <WifiOff className="h-3 w-3" /> Offline
    </Badge>
  );
}

export function WhatsappPanel({ variant = 'page', onClose }: WhatsappPanelProps) {
  const { toast } = useToast();
  const wa = useWhatsApp({});
  const { status, isLoading } = wa;

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignAudience, setCampaignAudience] = useState<WhatsappCampaign['audience']>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const connected = status.connected;

  const handleSend = async () => {
    const text = draft.trim();
    if (!wa.activePhone || !text || busyAction) return;
    setBusyAction('send');
    setDraft('');
    const r = await wa.sendMessage(wa.activePhone, text);
    setBusyAction(null);
    if (!r.ok) toast({ variant: 'destructive', title: 'Send failed', description: r.message });
    else toast({ title: 'Message sent', description: `Sent to ${wa.getContactName(wa.activePhone)}` });
  };

  const handleConnect = async () => {
    setBusyAction('connect');
    const r = await wa.connect();
    setBusyAction(null);
    if (!r.ok) toast({ variant: 'destructive', title: 'Could not connect', description: r.message });
  };

  const handleLogout = async () => {
    setBusyAction('logout');
    await wa.logout();
    setBusyAction(null);
    toast({ title: 'Disconnected', description: 'WhatsApp session was removed.' });
  };

  const openChat = async (contact: WhatsappContact) => {
    await wa.loadMessages(contact.phone);
    setSearch('');
  };

  const handleCampaignSend = async (c: WhatsappCampaign) => {
    setBusyAction(`campaign-${c.id}`);
    const r = await wa.runCampaign(c.id);
    setBusyAction(null);
    if (!r.ok) toast({ variant: 'destructive', title: 'Campaign failed', description: r.message });
    else toast({ title: 'Campaign sent', description: r.data ? `${r.data.sent}/${r.data.total} delivered` : 'Done' });
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !campaignMessage.trim() || busyAction) return;
    setBusyAction('create-campaign');
    const r = await wa.createCampaign(campaignName.trim(), campaignMessage.trim(), campaignAudience);
    setBusyAction(null);
    if (r.ok) {
      setCampaignName(''); setCampaignMessage(''); setCampaignAudience('all');
      toast({ title: 'Campaign created', description: 'Hit Send to broadcast it.' });
    } else {
      toast({ variant: 'destructive', title: 'Could not create campaign', description: r.message });
    }
  };

  const visibleContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? wa.contacts.filter((c) => (c.name || '').toLowerCase().includes(q) || c.phone.includes(q)) : wa.contacts;
    return list;
  }, [wa.contacts, search]);

  return (
    <div className={cn(
      "flex flex-col overflow-hidden border rounded-xl bg-background h-full",
      variant === 'page' ? "shadow-sm" : "h-[85vh] max-h-[85vh] shadow-2xl border-rounded-none sm:rounded-t-xl"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">WhatsApp Business</p>
            <p className="text-xs text-muted-foreground truncate">
              {connected ? (wa.status.phone ? fmtPhone(wa.status.phone) : 'Connected') : 'Link your device to get started'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusChip connected={connected} status={status.status} />
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close WhatsApp panel">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading && !connected ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground flex-col gap-3">
          <LogoSpinner size={40} />
          <p className="text-sm">Checking connection…</p>
        </div>
      ) : !connected ? (
        <ConnectView
          status={status.status}
          qr={status.qr}
          lastError={status.lastError}
          busy={busyAction === 'connect'}
          onConnect={handleConnect}
        />
      ) : (
        <>
          <Tabs defaultValue="chats" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-2 shrink-0">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="chats" className="text-xs">Chats</TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
                <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chats" className="flex-1 min-h-0 flex flex-col m-0">
              <ChatsTab
                contacts={visibleContacts}
                activePhone={wa.activePhone}
                messages={wa.messages}
                search={search}
                getContactName={wa.getContactName}
                onSearch={setSearch}
                onOpen={(c) => void openChat(c)}
              />
            </TabsContent>

            <TabsContent value="contacts" className="flex-1 min-h-0 flex flex-col m-0">
              <ContactsTab contacts={wa.contacts} onAdded={() => void wa.refreshContacts()} onOpen={(c) => void openChat(c)} />
            </TabsContent>

            <TabsContent value="campaigns" className="flex-1 min-h-0 flex flex-col m-0 p-3">
              <CampaignsTab
                campaigns={wa.campaigns}
                name={campaignName}
                message={campaignMessage}
                audience={campaignAudience}
                busy={busyAction}
                onName={setCampaignName}
                onMessage={setCampaignMessage}
                onAudience={setCampaignAudience}
                onCreate={() => void handleCreateCampaign()}
                onSend={(c) => void handleCampaignSend(c)}
              />
            </TabsContent>

            <TabsContent value="settings" className="flex-1 min-h-0 flex flex-col m-0 p-4">
              <SettingsTab
                autoSend={status.autoSendBill ?? false}
                phone={wa.status.phone}
                busy={busyAction === 'logout'}
                onAutoSend={(v) => void wa.toggleAutoSend(v)}
                onLogout={() => void handleLogout()}
              />
            </TabsContent>
          </Tabs>

          {wa.activePhone && (
            <div className="flex items-center gap-2 p-2 border-t bg-background shrink-0">
              <Input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                placeholder={`Message ${wa.getContactName(wa.activePhone)}…`}
                className="h-9"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => void handleSend()} disabled={!draft.trim() || busyAction === 'send'} aria-label="Send message">
                {busyAction === 'send' ? <LogoSpinner size={18} className="[&_svg]:fill-current" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ connect ------------------------------ */

function ConnectView({ status, qr, lastError, busy, onConnect }: {
  status: string; qr?: string | null; lastError?: string | null; busy: boolean; onConnect: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      {status === 'qr' && qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="WhatsApp QR code" className="w-56 h-56 rounded-lg border border-border bg-white p-2" />
          <div className="max-w-xs">
            <p className="text-sm font-semibold">Scan to link your device</p>
            <p className="text-xs text-muted-foreground mt-1">
              Open <strong>WhatsApp</strong> on your phone → Settings → Linked devices → <strong>Link a device</strong> → scan this code.
            </p>
          </div>
        </>
      ) : status === 'connecting' || status === 'qr' ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LogoSpinner size={44} />
          <p className="text-sm">Preparing secure connection…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-7 w-7" />
          </span>
          <div className="max-w-xs">
            <p className="text-sm font-semibold">{lastError ? 'Link your device again' : 'Connect WhatsApp'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {lastError || 'Link your WhatsApp once. The session is saved locally, so you won\'t need to rescan unless you log out.'}
            </p>
          </div>
          {lastError && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 max-w-xs">{lastError}</p>
          )}
          <Button onClick={onConnect} disabled={busy} className="gap-2">
            {busy ? <LogoSpinner size={16} /> : <RotateCcw className="h-4 w-4" />}
            {lastError ? 'Reconnect' : 'Connect WhatsApp'}
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-2 max-w-sm">
        Only you can see this. Send bills to customers and run campaigns straight from StockFlow.
      </p>
    </div>
  );
}

/* ------------------------------ chats ------------------------------ */

function ChatsTab({ contacts, activePhone, messages, search, getContactName, onSearch, onOpen }: {
  contacts: WhatsappContact[];
  activePhone: string | null;
  messages: ReturnType<typeof useWhatsApp>['messages'];
  search: string;
  getContactName: (p: string) => string;
  onSearch: (s: string) => void;
  onOpen: (c: WhatsappContact) => void;
}) {
  return (
    <div className="flex flex-1 min-h-0">
      {/* contact list */}
      <div className={cn("flex flex-col border-r min-w-0", activePhone ? "hidden md:flex w-64" : "flex flex-1")}>
        <div className="p-2 relative">
          <Search className="h-3.5 w-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search customers…" className="h-8 text-sm pl-8" />
        </div>
        <ScrollArea className="flex-1">
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              No contacts yet. Send a bill to a customer with a phone number and they\'ll appear here as your WhatsApp CRM.
            </p>
          ) : (
            contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpen(c)}
                className={cn(
                  "w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors",
                  activePhone === c.phone && "bg-muted"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                  {(c.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-semibold">{c.name || fmtPhone(c.phone)}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {fmtTime(c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : undefined)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.phone} · {c.totalBills ?? 0} bill{c.totalBills === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* conversation */}
      {activePhone ? (
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 md:hidden">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { /* back handled by closing chat */ }}>
              ← Back
            </Button>
            <span className="text-sm font-semibold truncate">{getContactName(activePhone)}</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-3">
              {messages.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">No messages yet with this contact.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[78%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      m.direction === 'out'
                        ? "self-end bg-primary text-primary-foreground rounded-br-none"
                        : "self-start bg-muted text-foreground rounded-bl-none"
                    )}
                  >
                    {m.text}
                    <span className={cn("block text-[10px] mt-1", m.direction === 'out' ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {m.kind === 'bill' ? '📄 Invoice · ' : m.kind === 'promo' ? '📣 Promo · ' : ''}
                      {fmtTime(m.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-2">
          <MessageCircle className="h-10 w-10 opacity-30" />
          <p className="text-sm">Select a contact to start messaging</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ contacts ------------------------------ */

function ContactsTab({ contacts, onAdded, onOpen }: { contacts: WhatsappContact[]; onAdded: () => void; onOpen: (c: WhatsappContact) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const addContact = async () => {
    if (!name.trim() && !phone.trim()) return;
    const companyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') : null;
    if (!companyId) return;
    const res = await fetch('/api/whatsapp/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, name: name.trim(), phone: phone.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      setName(''); setPhone('');
      toast({ title: 'Contact saved' });
      onAdded();
    } else {
      toast({ variant: 'destructive', title: 'Could not save contact', description: json.message });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-2 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="h-8 text-sm flex-1"
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="h-8 text-sm flex-1"
          inputMode="tel"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => void addContact()} aria-label="Add contact">
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        {contacts.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-8">Your customer list will build here automatically from billed phone numbers.</p>
        ) : (
          contacts.map((c) => (
            <button key={c.id} onClick={() => onOpen(c)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60">
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{c.name || fmtPhone(c.phone)}</span>
                <span className="block text-xs text-muted-foreground truncate">{fmtPhone(c.phone)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-semibold">{c.totalBills ?? 0} bills</span>
                <span className="block text-[11px] text-muted-foreground">
                  {typeof c.totalSpend === 'number' ? `₹${c.totalSpend.toLocaleString('en-IN')}` : ''}
                </span>
              </span>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

/* ------------------------------ campaigns ------------------------------ */

function CampaignsTab({ campaigns, name, message, audience, busy, onName, onMessage, onAudience, onCreate, onSend }: {
  campaigns: WhatsappCampaign[];
  name: string; message: string; audience: WhatsappCampaign['audience'];
  busy: string | null;
  onName: (s: string) => void; onMessage: (s: string) => void;
  onAudience: (a: WhatsappCampaign['audience']) => void;
  onCreate: () => void; onSend: (c: WhatsappCampaign) => void;
}) {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
      <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Megaphone className="h-4 w-4 text-primary" /> New promotional broadcast</p>
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Campaign name (e.g. Diwali Offer)" className="h-8 text-sm" />
        <Textarea value={message} onChange={(e) => onMessage(e.target.value)} placeholder="Message… use {{name}} to personalise per customer" className="text-sm min-h-[96px]" rows={4} />
        <div className="flex items-center gap-2">
          <Select value={audience} onValueChange={(v) => onAudience(v as WhatsappCampaign['audience'])}>
            <SelectTrigger className="h-8 text-sm flex-1">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={onCreate} disabled={!name.trim() || !message.trim() || busy === 'create-campaign'} className="h-8">
            {busy === 'create-campaign' ? <LogoSpinner size={14} /> : <UserPlus className="h-3.5 w-3.5" />} Create
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {campaigns.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-6">No campaigns yet.</p>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="rounded-lg border p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.message.slice(0, 200)}</p>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{AUDIENCE_LABELS[c.audience]}</Badge>
                  {c.status === 'sent'
                    ? <span className="text-emerald-600">{c.sentCount}/{c.totalCount} sent</span>
                    : c.status === 'sending' ? <span className="text-amber-600">Sending…</span> : <span>Draft</span>}
                </p>
              </div>
              <Button
                size="sm"
                variant={c.status === 'sent' ? 'secondary' : 'default'}
                className="h-8 shrink-0"
                disabled={c.status === 'sending' || c.status === 'sent' || busy === `campaign-${c.id}`}
                onClick={() => onSend(c)}
              >
                {c.status === 'sent' ? <CheckCircle2 className="h-3.5 w-3.5" /> : c.status === 'sending' || busy === `campaign-${c.id}` ? <LogoSpinner size={14} /> : <Send className="h-3.5 w-3.5" />}
                {c.status === 'sent' ? 'Sent' : 'Send'}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------ settings ------------------------------ */

function SettingsTab({ autoSend, phone, busy, onAutoSend, onLogout }: {
  autoSend: boolean; phone?: string | null; busy: boolean;
  onAutoSend: (v: boolean) => void; onLogout: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Auto-send bills on WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-1">
            When enabled, every saved bill with a customer phone is sent to them automatically. You can still turn it off per bill in the print dialog.
          </p>
        </div>
        <Switch checked={autoSend} onCheckedChange={onAutoSend} />
      </div>

      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-sm font-semibold flex items-center gap-1.5"><PhoneIcon className="h-4 w-4 text-primary" /> Linked device</p>
        {phone ? (
          <p className="text-xs text-muted-foreground">WhatsApp number: <strong>{fmtPhone(phone)}</strong></p>
        ) : (
          <p className="text-xs text-muted-foreground">No device linked.</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Sessions are stored locally on this machine. Promotional messages are subject to WhatsApp policy — message only customers who opted in.
        </p>
      </div>

      <div className="rounded-lg border border-red-200 p-3">
        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5"><LogOut className="h-4 w-4" /> Log out</p>
        <p className="text-xs text-muted-foreground mt-1">Removes this WhatsApp session from StockFlow. You\'ll need to scan the QR again to reconnect.</p>
        <Button variant="destructive" size="sm" className="mt-2 h-8" onClick={onLogout} disabled={busy}>
          {busy ? <LogoSpinner size={14} /> : <Power className="h-3.5 w-3.5" />} Disconnect
        </Button>
      </div>
    </div>
  );
}