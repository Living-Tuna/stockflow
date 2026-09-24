import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { startWhatsapp } from '@/lib/whatsapp/engine';
import { upsertConnection } from '@/lib/whatsapp/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }

  try {
    const state = await startWhatsapp(companyId);

    if (state.status === 'qr' && state.qr) {
      const qr = await QRCode.toDataURL(state.qr, {
        margin: 1,
        width: 240,
        color: { dark: '#14532d', light: '#ffffff' },
      });
      return NextResponse.json({ success: true, data: { status: state.status, qr } });
    }

    const patch: Record<string, unknown> = {
      status: state.status,
      last_error: state.lastError ?? null,
    };
    if (state.phone) patch.phone_number = state.phone;
    await upsertConnection(companyId, patch as any).catch(() => undefined);

    return NextResponse.json({ success: true, data: { status: state.status } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to start WhatsApp connection.' },
      { status: 500 }
    );
  }
}