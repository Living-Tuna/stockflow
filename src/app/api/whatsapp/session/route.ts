import { NextRequest, NextResponse } from 'next/server';
import { getWhatsappSession, getWhatsappState } from '@/lib/whatsapp/engine';

// Export the live in-memory Baileys session (creds + signal keys) so the client
// can cache it in the browser and re-upload it on connect. Because the server
// never writes to disk, this route is the only way to persist/restore a link.
export async function GET(req: NextRequest) {
  const companyId = new URL(req.url).searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }

  const state = getWhatsappState(companyId);
  if (state.status !== 'connected') {
    return NextResponse.json(
      { success: false, message: 'WhatsApp is not connected, so there is no session to cache.' },
      { status: 409 }
    );
  }

  const session = getWhatsappSession(companyId);
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'No linked session available yet.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { session } });
}