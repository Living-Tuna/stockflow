import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EARLY_BIRD_EVENT } from '@/lib/constants';

const routeNamePrefix = "[API_EARLY_BIRD_STATUS /api/earlybird/status]";

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const usedSlots = await db.collection('companies').countDocuments({ discountCode: EARLY_BIRD_EVENT.code });
    const expiresAt = EARLY_BIRD_EVENT.expiresAt;
    const isActive = Date.now() < new Date(expiresAt).getTime() && usedSlots < EARLY_BIRD_EVENT.totalSlots;

    return NextResponse.json({
      success: true,
      code: EARLY_BIRD_EVENT.code,
      discountPercent: EARLY_BIRD_EVENT.discountPercent,
      totalSlots: EARLY_BIRD_EVENT.totalSlots,
      usedSlots,
      slotsLeft: Math.max(0, EARLY_BIRD_EVENT.totalSlots - usedSlots),
      expiresAt,
      isActive,
    });
  } catch (error) {
    console.error(`${routeNamePrefix} Error fetching early bird status:`, error);
    return NextResponse.json({ success: false, message: 'Could not fetch early bird status.' }, { status: 500 });
  }
}