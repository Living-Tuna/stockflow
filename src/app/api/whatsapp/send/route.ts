import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsappText } from '@/lib/whatsapp/engine';
import { recordMessage } from '@/lib/whatsapp/store';
import { sendBillOnWhatsapp } from '@/lib/whatsapp/send-bill';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }

  try {
    // Sending a whole bill uses the bill's stored customer phone.
    if (body.billId) {
      const res = await sendBillOnWhatsapp(companyId, body.billId);
      if (!res.ok) {
        return NextResponse.json({ success: false, message: res.error || 'Failed to send bill.' }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: { messageId: res.messageId } });
    }

    const phone = String(body.phone || '').replace(/\D/g, '');
    const text = String(body.text || '').trim();
    if (!phone) {
      return NextResponse.json({ success: false, message: 'A recipient phone number is required.' }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ success: false, message: 'Message text is required.' }, { status: 400 });
    }

    const result = await sendWhatsappText(companyId, phone, text);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error || 'Failed to send message.' },
        { status: 502 }
      );
    }

    const recorded = await recordMessage({
      companyId,
      contactPhone: phone,
      direction: 'out',
      kind: 'manual',
      text,
      status: 'sent',
      timestamp: Date.now(),
    }).catch(() => null);

    return NextResponse.json({ success: true, data: { messageId: result.messageId ?? recorded?.id } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to send WhatsApp message.' },
      { status: 500 }
    );
  }
}