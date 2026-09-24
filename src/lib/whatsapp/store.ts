// Server-only persistence helpers for the WhatsApp domain.
// Thin wrappers over the MongoDB-style adapter (`@/lib/db`) that maps to the
// Supabase tables created in migration 006.
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/lib/db';
import type {
  Bill,
  WhatsappConnection,
  WhatsappContact,
  WhatsappMessage,
  WhatsappCampaign,
} from '@/types';

const normPhone = (raw: string) => String(raw || '').replace(/\D/g, '');

/* ---------------- connection meta ---------------- */

export async function upsertConnection(companyId: string, patch: Partial<WhatsappConnection>): Promise<void> {
  const { db } = await connectToDatabase();
  const existing = await db.collection('whatsapp_connections').findOne({ companyId });
  const now = new Date().toISOString();
  if (existing) {
    await db.collection('whatsapp_connections').updateOne(
      { companyId },
      { $set: { ...patch, updated_at: now } }
    );
  } else {
    const doc: any = {
      id: uuidv4(),
      companyId,
      status: 'idle',
      autoSendBill: false,
      ...patch,
      updated_at: now,
    };
    await db.collection('whatsapp_connections').insertOne(doc);
  }
}

export async function getConnection(companyId: string): Promise<WhatsappConnection | null> {
  const { db } = await connectToDatabase();
  return (await db.collection('whatsapp_connections').findOne({ companyId })) || null;
}

export async function setAutoSendBill(companyId: string, enabled: boolean): Promise<void> {
  await upsertConnection(companyId, { autoSendBill: enabled });
}

export async function isAutoSendEnabled(companyId: string): Promise<boolean> {
  const conn = await getConnection(companyId);
  return !!conn?.autoSendBill;
}

/* ---------------- contacts (CRM) ---------------- */

export async function upsertContactFromBill(bill: Bill): Promise<void> {
  const { db } = await connectToDatabase();
  const phone = normPhone(bill.customerPhone || '');
  if (!phone) return;
  const now = new Date().toISOString();
  const existing = await db.collection('whatsapp_contacts').findOne({ companyId: bill.companyId, phone });
  if (existing) {
    await db.collection('whatsapp_contacts').updateOne(
      { companyId: bill.companyId, phone },
      {
        $set: {
          name: bill.vendorOrCustomerName || (existing.name as string) || null,
          last_bill_id: bill.id,
          last_bill_date: bill.date,
          total_bills: Number(existing.totalBills ?? 1) + 1,
          total_spend: Number(existing.totalSpend ?? 0) + Number(bill.totalAmount ?? 0),
          updated_at: now,
        },
      }
    );
  } else {
    await db.collection('whatsapp_contacts').insertOne({
      id: uuidv4(),
      companyId: bill.companyId,
      phone,
      name: bill.vendorOrCustomerName || null,
      last_bill_id: bill.id,
      last_bill_date: bill.date,
      total_bills: 1,
      total_spend: Number(bill.totalAmount ?? 0),
      message_count: 0,
      last_message_at: null,
      created_at: now,
    });
  }
}

export async function listContacts(companyId: string, search?: string, limit = 200): Promise<WhatsappContact[]> {
  const { db } = await connectToDatabase();
  let cursor = db.collection('whatsapp_contacts').find({ companyId });
  const rows = (await cursor.toArray()) as WhatsappContact[];
  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = rows.filter((c) =>
      (c.name || '').toLowerCase().includes(q) || c.phone.includes(q)
    );
  }
  return filtered
    .sort((a, b) => (b.lastMessageAt || b.createdAt || '').localeCompare(a.lastMessageAt || a.createdAt || ''))
    .slice(0, limit);
}

/* ---------------- messages ---------------- */

export async function recordMessage(msg: Omit<WhatsappMessage, 'id' | 'companyId'> & { companyId: string }): Promise<WhatsappMessage> {
  const { db } = await connectToDatabase();
  const doc: WhatsappMessage = { ...msg, id: uuidv4(), status: msg.status || 'sent' };
  await db.collection('whatsapp_messages').insertOne(doc);
  // Keep the contact's message counters in sync for the CRM view.
  const phone = normPhone(msg.contactPhone);
  if (phone) {
    const existing = await db.collection('whatsapp_contacts').findOne({ companyId: msg.companyId, phone });
    if (existing) {
      await db.collection('whatsapp_contacts').updateOne(
        { companyId: msg.companyId, phone },
        { $set: { message_count: Number(existing.messageCount ?? 0) + 1, last_message_at: new Date(msg.timestamp).toISOString() } }
      );
    } else {
      await db.collection('whatsapp_contacts').insertOne({
        id: uuidv4(),
        companyId: msg.companyId,
        phone,
        name: null,
        total_bills: 0,
        total_spend: 0,
        message_count: 1,
        last_message_at: new Date(msg.timestamp).toISOString(),
        created_at: new Date().toISOString(),
      });
    }
  }
  return doc;
}

export async function listMessages(companyId: string, phone: string, limit = 100): Promise<WhatsappMessage[]> {
  const { db } = await connectToDatabase();
  let cursor = db.collection('whatsapp_messages').find({ companyId, contactPhone: normPhone(phone) });
  const rows = (await cursor.toArray()) as WhatsappMessage[];
  return (rows as WhatsappMessage[])
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
}

/* ---------------- campaigns ---------------- */

export async function createCampaign(data: { companyId: string; name: string; message: string; audience: WhatsappCampaign['audience'] }): Promise<WhatsappCampaign> {
  const { db } = await connectToDatabase();
  const doc: WhatsappCampaign = {
    id: uuidv4(),
    ...data,
    status: 'draft',
    sentCount: 0,
    totalCount: 0,
    createdAt: new Date().toISOString(),
    sentAt: null,
  };
  await db.collection('whatsapp_campaigns').insertOne(doc);
  return doc;
}

export async function listCampaigns(companyId: string): Promise<WhatsappCampaign[]> {
  const { db } = await connectToDatabase();
  const rows = (await db.collection('whatsapp_campaigns').find({ companyId }).toArray()) as WhatsappCampaign[];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateCampaign(id: string, companyId: string, patch: Partial<WhatsappCampaign>): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('whatsapp_campaigns').updateOne({ id, companyId }, { $set: { ...patch } });
}

/* ---------------- incoming message wiring (registered once) ---------------- */

let incomingWired = false;
export function registerIncomingHandler() {
  if (incomingWired) return;
  incomingWired = true;
  // Deferred import to avoid pulling baileys into client bundles.
  void import('./engine').then((engine) => {
    engine.onIncomingWhatsappMessage(async (companyId, { phone, text, timestamp }) => {
      if (!phone) return;
      await recordMessage({
        companyId,
        contactPhone: phone,
        direction: 'in',
        kind: 'manual',
        text: String(text || '').slice(0, 4096),
        timestamp: Number(timestamp) || Date.now(),
        status: 'delivered',
      });
      // Auto-reply acknowledgement for simple manual chats (optional future).
    });
  });
}