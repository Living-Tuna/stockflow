import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/lib/db';
import { listContacts } from '@/lib/whatsapp/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
  }
  try {
    const contacts = await listContacts(companyId, searchParams.get('search') || undefined);
    return NextResponse.json({ success: true, data: contacts });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load WhatsApp contacts.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  const phone = String(body?.phone || '').replace(/\D/g, '');
  if (!companyId || !phone) {
    return NextResponse.json({ success: false, message: 'Company ID and phone are required.' }, { status: 400 });
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const existing = await db.collection('whatsapp_contacts').findOne({ companyId, phone });
    if (existing) {
      await db.collection('whatsapp_contacts').updateOne(
        { companyId, phone },
        { $set: { name: body?.name || (existing.name as string) || null, updated_at: now } }
      );
      return NextResponse.json({ success: true, data: { ...existing, name: body?.name || existing.name } });
    }
    const doc = {
      id: uuidv4(),
      companyId,
      phone,
      name: body?.name || null,
      total_bills: 0,
      total_spend: 0,
      message_count: 0,
      last_message_at: null,
      created_at: now,
    };
    await db.collection('whatsapp_contacts').insertOne(doc);
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to save WhatsApp contact.' },
      { status: 500 }
    );
  }
}