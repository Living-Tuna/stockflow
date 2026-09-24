import { NextRequest, NextResponse } from 'next/server';
import { logoutWhatsapp } from '@/lib/whatsapp/engine';
import { upsertConnection } from '@/lib/whatsapp/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }

  try {
    const res = await logoutWhatsapp(companyId);
    await upsertConnection(companyId, { status: 'idle', phone_number: null, last_error: null } as any).catch(() => undefined);
    if (!res.ok) {
      return NextResponse.json({ success: false, message: res.error || 'Failed to log out.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { status: 'idle' } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to log out.' },
      { status: 500 }
    );
  }
}