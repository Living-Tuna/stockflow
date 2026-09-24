import { NextRequest, NextResponse } from 'next/server';
import { sendBillOnWhatsapp } from '@/lib/whatsapp/send-bill';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  const billId = body?.billId;
  if (!companyId || !billId) {
    return NextResponse.json(
      { success: false, message: 'Company ID and Bill ID are required.' },
      { status: 400 }
    );
  }

  try {
    const res = await sendBillOnWhatsapp(companyId, billId);
    if (!res.ok) {
      return NextResponse.json({ success: false, message: res.error || 'Failed to send bill.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: { messageId: res.messageId } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to send bill.' },
      { status: 500 }
    );
  }
}