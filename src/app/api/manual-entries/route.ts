import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import type { ManualEntry, ManualEntryType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const routeNamePrefix = "[API_MANUAL_ENTRIES_COLLECTION /api/manual-entries]";

const ENTRY_TYPES: ManualEntryType[] = ['income', 'expense', 'opening_balance'];

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

export async function GET(req: NextRequest) {
  const routeLogName = `${routeNamePrefix} GET`;
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const storeId = searchParams.get('storeId');
    const date = searchParams.get('date');

    if (!companyId) {
      return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
    }

    const filter: any = { companyId };
    if (storeId && storeId !== 'all' && storeId !== 'null') filter.storeId = storeId;
    if (date) {
      if (!isValidDateKey(date)) {
        return NextResponse.json({ success: false, message: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
      }
      filter.date = date;
    }

    const entries = await db.collection<ManualEntry>('manual_entries')
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error(`${routeLogName} Error:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const routeLogName = `${routeNamePrefix} POST`;
  try {
    const { db } = await connectToDatabase();
    const body = await req.json();
    const { companyId, storeId, date, entryType, amount, category, note } = body;

    if (!companyId) {
      return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
    }
    if (!date || !isValidDateKey(date)) {
      return NextResponse.json({ success: false, message: 'A valid date (YYYY-MM-DD) is required.' }, { status: 400 });
    }
    if (!ENTRY_TYPES.includes(entryType)) {
      return NextResponse.json({ success: false, message: 'entryType must be income, expense, or opening_balance.' }, { status: 400 });
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ success: false, message: 'Amount must be a non-negative number.' }, { status: 400 });
    }

    const newEntry: ManualEntry = {
      id: `entry_${uuidv4()}`,
      companyId,
      storeId: storeId && storeId !== 'all' && storeId !== 'null' ? storeId : null,
      date,
      entryType,
      category: typeof category === 'string' && category.trim() ? category.trim() : undefined,
      amount: Math.round(parsedAmount * 100) / 100,
      note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    await db.collection<ManualEntry>('manual_entries').insertOne(newEntry);
    console.log(`${routeLogName} Created ${entryType} entry (${newEntry.amount}) for company ${companyId} on ${date}.`);

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error(`${routeLogName} Error creating entry:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}