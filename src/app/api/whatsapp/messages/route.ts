import { NextRequest, NextResponse } from 'next/server';
import { listMessages } from '@/lib/whatsapp/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const phone = searchParams.get('phone') || '';
  if (!companyId || !phone) {
    return NextResponse.json({ success: false, message: 'Company ID and phone are required.' }, { status: 400 });
  }
  try {
    const messages = await listMessages(companyId, phone);
    return NextResponse.json({ success: true, data: messages });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load message history.' },
      { status: 500 }
    );
  }
}