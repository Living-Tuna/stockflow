import { NextRequest, NextResponse } from 'next/server';
import { setAutoSendBill } from '@/lib/whatsapp/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ success: false, message: '"enabled" (boolean) is required.' }, { status: 400 });
  }
  try {
    await setAutoSendBill(companyId, body.enabled);
    return NextResponse.json({ success: true, data: { autoSendBill: body.enabled } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to update WhatsApp settings.' },
      { status: 500 }
    );
  }
}