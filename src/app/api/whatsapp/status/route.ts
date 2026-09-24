import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getWhatsappState } from '@/lib/whatsapp/engine';
import { getConnection, registerIncomingHandler } from '@/lib/whatsapp/store';

registerIncomingHandler();

const qrCache = new Map<string, { url: string; at: number }>();

async function qrDataUrl(companyId: string, rawQr: string): Promise<string> {
  const cached = qrCache.get(companyId);
  if (cached && Date.now() - cached.at < 8000) return cached.url;
  const url = await QRCode.toDataURL(rawQr, {
    margin: 1,
    width: 240,
    color: { dark: '#14532d', light: '#ffffff' },
  });
  qrCache.set(companyId, { url, at: Date.now() });
  return url;
}

export async function GET(req: NextRequest) {
  const companyId = new URL(req.url).searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }

  try {
    const engine = getWhatsappState(companyId);
    const dbConn = await getConnection(companyId).catch(() => null);

    let qr: string | null = null;
    if (engine.status === 'qr' && engine.qr) {
      qr = await qrDataUrl(companyId, engine.qr);
    }

    const data = {
      status: engine.status,
      connected: engine.status === 'connected',
      qr,
      phone: engine.phone ?? dbConn?.phoneNumber ?? null,
      lastError: engine.lastError ?? dbConn?.lastError ?? null,
      autoSendBill: !!dbConn?.autoSendBill,
    };
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to read WhatsApp status.' },
      { status: 500 }
    );
  }
}