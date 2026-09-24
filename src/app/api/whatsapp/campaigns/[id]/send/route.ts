import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { listContacts, updateCampaign, recordMessage } from '@/lib/whatsapp/store';
import { sendWhatsappText } from '@/lib/whatsapp/engine';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  if (!companyId || !params.id) {
    return NextResponse.json({ success: false, message: 'Company ID and campaign ID are required.' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const campaign = await db.collection('whatsapp_campaigns').findOne({ id: params.id, companyId });
    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found.' }, { status: 404 });
    }
    if (campaign.status === 'sending') {
      return NextResponse.json({ success: false, message: 'Campaign is already sending.' }, { status: 409 });
    }

    let contacts = await listContacts(companyId, undefined, 1000);
    if (campaign.audience === 'with_bills') contacts = contacts.filter((c) => Number(c.totalBills ?? 0) > 0);
    else if (campaign.audience === 'recent') {
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days
      contacts = contacts.filter((c) => new Date(c.lastBillDate || c.lastMessageAt || 0).getTime() > cutoff);
    } else if (campaign.audience === 'spenders') {
      contacts = contacts.filter((c) => Number(c.totalSpend ?? 0) >= 5000);
    }

    await updateCampaign(params.id, companyId, {
      status: 'sending',
      totalCount: contacts.length,
    });

    let sent = 0;
    let failed = 0;
    for (const contact of contacts) {
      const res = await sendWhatsappText(companyId, contact.phone, campaign.message);
      if (res.ok) {
        sent += 1;
        await recordMessage({
          companyId,
          contactPhone: contact.phone,
          direction: 'out',
          kind: 'promo',
          text: campaign.message,
          status: 'sent',
          campaignId: params.id,
          timestamp: Date.now(),
        }).catch(() => undefined);
      } else {
        failed += 1;
      }
    }

    await updateCampaign(params.id, companyId, {
      status: 'sent',
      sentCount: sent,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { sent, failed, total: contacts.length },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to run campaign.' },
      { status: 500 }
    );
  }
}