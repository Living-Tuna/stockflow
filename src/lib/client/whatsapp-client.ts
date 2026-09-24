export { readAutoSendFlag as isWhatsappAutoSendEnabled } from '@/hooks/use-whatsapp';

export async function sendBillToWhatsapp(companyId: string, billId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/whatsapp/send-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, billId }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: !!json?.success, message: json?.message };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Network error' };
  }
}

function normalizePhone(phone?: string): string {
  if (!phone) return '';
  let p = phone.replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  else if (p.length === 11 && p.startsWith('0')) p = '91' + p.slice(1);
  return p;
}

export function billHasWhatsappPhone(bill: { customerPhone?: string } | null | undefined): boolean {
  return !!bill?.customerPhone && normalizePhone(bill.customerPhone).length >= 10;
}