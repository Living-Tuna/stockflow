import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, listCampaigns } from '@/lib/whatsapp/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }
  try {
    const campaigns = await listCampaigns(companyId);
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load campaigns.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  const name = String(body?.name || '').trim();
  const message = String(body?.message || '').trim();
  const audience = ['all', 'with_bills', 'recent', 'spenders'].includes(body?.audience) ? body.audience : 'all';
  if (!companyId || !name || !message) {
    return NextResponse.json(
      { success: false, message: 'Company ID, campaign name and message are required.' },
      { status: 400 }
    );
  }
  try {
    const campaign = await createCampaign({ companyId, name, message, audience });
    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to create campaign.' },
      { status: 500 }
    );
  }
}