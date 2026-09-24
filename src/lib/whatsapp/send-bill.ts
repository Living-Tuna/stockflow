// Server-only helper: builds and sends a bill over WhatsApp, then records it
// in the CRM (message history + contact rollup).
import { connectToDatabase } from '@/lib/db';
import type { Bill, Company } from '@/types';
import { sendWhatsappText } from '@/lib/whatsapp/engine';
import { buildBillWhatsappMessage } from '@/lib/whatsapp/bill-message';
import { recordMessage, upsertContactFromBill } from '@/lib/whatsapp/store';

export async function sendBillOnWhatsapp(
  companyId: string,
  billId: string
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const { db } = await connectToDatabase();
  const bill = ((await db.collection('bills').findOne({ id: billId, companyId })) ?? null) as unknown as Bill | null;
  if (!bill) return { ok: false, error: 'Bill not found.' };
  if (!bill.customerPhone) {
    return { ok: false, error: 'This bill does not have a customer phone number — add one to send it on WhatsApp.' };
  }
  const company = ((await db.collection('companies').findOne({ id: companyId })) ?? null) as unknown as Company | null;
  if (!company) return { ok: false, error: 'Company profile not found.' };

  const text = buildBillWhatsappMessage(bill, company);
  const result = await sendWhatsappText(companyId, bill.customerPhone, text);
  if (!result.ok) return result;

  await Promise.all([
    recordMessage({
      companyId,
      contactPhone: bill.customerPhone,
      direction: 'out',
      kind: 'bill',
      text,
      billId: bill.id,
      status: 'sent',
      timestamp: Date.now(),
    }).catch(() => undefined),
    upsertContactFromBill(bill).catch(() => undefined),
  ]);

  return { ok: true, messageId: result.messageId };
}