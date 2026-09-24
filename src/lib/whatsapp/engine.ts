// Server-only WhatsApp engine.
//
// Owns the live WhatsApp Web (Baileys) connection per company. Auth state lives
// ONLY in process memory; nothing is written to disk. The browser is the durable
// store: the client caches the serialized session (creds + signal keys) in its
// own storage and re-uploads it via POST /api/whatsapp/connect whenever the
// server has no live connection (restart / cold start / shared host with a
// read-only filesystem).
// This module must ONLY be imported from API route handlers / server code —
// never from client components.
import makeWASocket, {
  DisconnectReason,
  type WASocket,
  type AnyMessageContent,
  type SignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import type { WhatsappConnectionState } from '@/types';

const logger = pino({ level: 'silent' });

export interface WhatsAppEngineState {
  companyId: string;
  status: WhatsappConnectionState;
  phone?: string;
  qr?: string;
  qrExpiresAt?: number;
  lastError?: string;
  connectedAt?: number;
  disconnectedAt?: number;
}

interface EngineEntry {
  sock: WASocket;
  state: WhatsAppEngineState;
  /** Serialize the in-memory auth (creds + signal keys) for browser caching. */
  serialize: () => string | null;
}

export const DEFAULT_QR_TIMEOUT_MS = 90_000;

function normalizePhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '91' + digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return digits;
}

function jidFor(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function getRegistry(): Map<string, EngineEntry> {
  const g = globalThis as any;
  if (!g.__whatsappEngine) {
    g.__whatsappEngine = new Map<string, EngineEntry>();
  }
  return g.__whatsappEngine as Map<string, EngineEntry>;
}

/* ---------------- in-memory auth state ---------------- */

interface ParsedSession {
  creds?: any;
  keys?: Record<string, any>;
}

/**
 * A Baileys SignalKeyStore that lives entirely in memory and can serialize the
 * whole session to a single JSON string (and rebuild it from that string).
 * Mirrors the `useSingleFileAuthState` pattern, minus the filesystem.
 */
function createAuthState(saved?: ParsedSession) {
  const entries = new Map<string, any>(Object.entries(saved?.keys ?? {}));
  let creds: any = saved?.creds ?? {};

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const out: Record<string, any> = {};
        for (const id of ids) {
          const value = entries.get(`${type}_${id}`);
          if (value !== undefined) out[id] = value;
        }
        return out;
      },
      set: async (data: Record<string, Record<string, any>>) => {
        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const value = data[category][id];
            if (value !== null && value !== undefined) entries.set(`${category}_${id}`, value);
            else entries.delete(`${category}_${id}`);
          }
        }
      },
    } satisfies SignalKeyStore,
  };

  return {
    state,
    serialize: (): string | null => {
      // `state.creds` is the reference Baileys itself mutates in place on every
      // creds.update (socket.js: Object.assign(creds, update)), so reading it
      // live always yields the full, current credentials.
      const creds = state.creds;
      if (!creds || !creds.id || !creds.registered) return null;
      return JSON.stringify({ creds, keys: Object.fromEntries(entries) });
    },
  };
}

/* ---------------- state helpers ---------------- */

function recordDisconnect(entry: EngineEntry, code?: number) {
  const wasConnected = entry.state.status === 'connected';
  entry.state.status = 'disconnected';
  entry.state.qr = undefined;
  entry.state.phone = undefined;
  entry.state.disconnectedAt = Date.now();
  if (code === DisconnectReason.loggedOut) {
    entry.state.lastError = 'Device logged out from WhatsApp. Reconnect and scan the QR code again.';
  } else if (!wasConnected) {
    entry.state.lastError = undefined;
  } else {
    entry.state.lastError = code ? `Connection dropped (code ${code}).` : 'Connection closed.';
  }
}

export function getWhatsappState(companyId: string): WhatsAppEngineState {
  const entry = getRegistry().get(companyId);
  if (!entry) {
    // No in-memory session on this server instance. Whether the browser holds a
    // cached one is a client-side concern (it re-uploads it on connect).
    return { companyId, status: 'idle' };
  }
  return { ...entry.state };
}

export function isWhatsappConnected(companyId: string): boolean {
  return getWhatsappState(companyId).status === 'connected';
}

/** Serialize the live auth regardless of state (used to export the browser cache). */
export function getWhatsappSession(companyId: string): string | null {
  const entry = getRegistry().get(companyId);
  if (!entry) return null;
  try {
    return entry.serialize();
  } catch {
    return null;
  }
}

export async function startWhatsapp(
  companyId: string,
  sessionRaw?: string | null,
): Promise<WhatsAppEngineState> {
  const registry = getRegistry();
  const existing = registry.get(companyId);
  if (existing) {
    if (existing.state.status === 'connected' || existing.state.status === 'qr' || existing.state.status === 'connecting') {
      return { ...existing.state };
    }
    // A dead socket lingers; tear it down before making a fresh one.
    teardownEntry(existing);
    registry.delete(companyId);
  }

  // Rehydrated from the browser cache (if the client supplied one); otherwise a
  // fresh, unregistered auth that will emit a pairing QR.
  let saved: ParsedSession | undefined;
  if (typeof sessionRaw === 'string' && sessionRaw) {
    try {
      saved = JSON.parse(sessionRaw) as ParsedSession;
    } catch { /* malformed cache → treat as no session */ }
  }
  const auth = createAuthState(saved);

  const entry: EngineEntry = {
    sock: undefined as unknown as WASocket,
    state: {
      companyId,
      status: saved ? 'connecting' : 'qr',
      qr: saved ? undefined : '', // placeholder until a real QR arrives
      lastError: undefined,
    },
    serialize: () => auth.serialize(),
  };
  registry.set(companyId, entry);

  const sock = makeWASocket({
    auth: auth.state,
    logger,
    browser: ['ecbills.in (StockFlow)', 'Chrome', '121'],
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    qrTimeout: DEFAULT_QR_TIMEOUT_MS,
  });
  entry.sock = sock;

  sock.ev.on('messages.upsert', (upsert: any) => {
    const messages = upsert?.messages || [];
    for (const msg of messages) {
      const keyId = msg?.key?.id;
      if (!keyId || keyId.startsWith('3A')) continue;      // skip reactions
      if (msg?.key?.remoteJid?.endsWith('@g.us')) continue; // group chats only
      if (msg?.key?.fromMe === true) continue;             // outgoing are recorded on send
      const text = typeof msg?.message?.conversation === 'string'
        ? msg.message.conversation
        : msg?.message?.extendedTextMessage?.text;
      if (!text) continue;
      const phone = normalizePhone(String(msg?.key?.remoteJid || '').split('@')[0] as string);
      if (!phone) continue;
      emitIncoming(companyId, phone, text, (msg?.messageTimestamp || Date.now()) as number);
    }
  });
  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update || {};
    if (qr) {
      entry.state.status = 'qr';
      entry.state.qr = qr;
      entry.state.qrExpiresAt = Date.now() + DEFAULT_QR_TIMEOUT_MS;
      entry.state.lastError = undefined;
      return;
    }
    if (connection === 'connecting') {
      entry.state.status = 'connecting';
      return;
    }
    if (connection === 'open') {
      entry.state.status = 'connected';
      entry.state.qr = undefined;
      entry.state.lastError = undefined;
      entry.state.connectedAt = Date.now();
      const id = (sock?.user?.id || update?.u?.id || '') as string;
      if (id) entry.state.phone = normalizePhone(String(id).split(':')[0] as string);
      return;
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      recordDisconnect(entry, code);
      registry.delete(companyId);
      return;
    }
  });

  return { ...entry.state };
}

export async function logoutWhatsapp(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const registry = getRegistry();
  const entry = registry.get(companyId);
  if (entry) {
    try {
      await entry.sock?.logout?.();
    } catch { /* not connected */ }
    teardownEntry(entry);
    registry.delete(companyId);
  }
  return { ok: true };
}

export async function sendWhatsappText(
  companyId: string,
  phone: string,
  text: string,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const entry = getRegistry().get(companyId);
  if (!entry || entry.state.status !== 'connected' || !entry.sock) {
    return { ok: false, error: entry?.state?.lastError || 'WhatsApp is not connected.' };
  }
  if (!phone) return { ok: false, error: 'A recipient phone number is required.' };
  if (!text) return { ok: false, error: 'Message text is empty.' };

  try {
    const content: AnyMessageContent = { text };
    const sent = await entry.sock.sendMessage(jidFor(phone), content);
    return { ok: true, messageId: sent?.key?.id ?? undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to send the WhatsApp message.' };
  }
}

export function onIncomingWhatsappMessage(callback: (companyId: string, meta: { phone: string; text: string; timestamp: number }) => void) {
  const g = globalThis as any;
  if (!g.__whatsappIncomingListeners) {
    g.__whatsappIncomingListeners = new Set<typeof callback>();
  }
  g.__whatsappIncomingListeners.add(callback);
  return () => {
    g.__whatsappIncomingListeners.delete(callback);
  };
}

export function emitIncoming(companyId: string, phone: string, text: string, timestamp: number) {
  const g = globalThis as any;
  (g.__whatsappIncomingListeners ?? [])?.forEach((cb: any) => cb(companyId, { phone, text, timestamp }));
}

function teardownEntry(entry: EngineEntry) {
  try { entry.sock?.end(undefined as any); } catch { /* ignore */ }
  entry.sock = undefined as unknown as WASocket;
}