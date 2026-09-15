import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import type { ManualEntry, ManualEntryType } from '@/types';

const routeNamePrefix = "[API_MANUAL_ENTRIES_SINGLE /api/manual-entries/[entryId]]";

const ENTRY_TYPES: ManualEntryType[] = ['income', 'expense', 'opening_balance'];

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

export async function PUT(req: NextRequest, { params }: { params: { entryId: string } }) {
  const routeLogName = `${routeNamePrefix} PUT /api/manual-entries/${params.entryId}`;
  try {
    const { db } = await connectToDatabase();
    const { entryId } = params;
    const body = await req.json();
    const { companyId, storeId, date, entryType, amount, category, note } = body;

    if (!companyId || !entryId) {
      return NextResponse.json({ success: false, message: 'Company ID and entry ID are required.' }, { status: 400 });
    }
    if (entryType !== undefined && !ENTRY_TYPES.includes(entryType)) {
      return NextResponse.json({ success: false, message: 'entryType must be income, expense, or opening_balance.' }, { status: 400 });
    }
    if (date !== undefined && !isValidDateKey(date)) {
      return NextResponse.json({ success: false, message: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ success: false, message: 'Amount must be a non-negative number.' }, { status: 400 });
      }
    }

    const $set: Partial<ManualEntry> = {};
    if (date !== undefined) $set.date = date;
    if (entryType !== undefined) $set.entryType = entryType;
    if (amount !== undefined) $set.amount = Math.round(Number(amount) * 100) / 100;
    $set.category = typeof category === 'string' && category.trim() ? category.trim() : undefined;
    $set.note = typeof note === 'string' && note.trim() ? note.trim() : undefined;
    if (storeId !== undefined) {
      $set.storeId = storeId && storeId !== 'all' && storeId !== 'null' ? storeId : null;
    }

    const result = await db.collection<ManualEntry>('manual_entries').updateOne(
      { id: entryId, companyId },
      { $set }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Entry not found.' }, { status: 404 });
    }

    const updatedEntry = await db.collection<ManualEntry>('manual_entries').findOne({ id: entryId, companyId });
    console.log(`${routeLogName} Updated entry ${entryId} for company ${companyId}.`);
    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error) {
    console.error(`${routeLogName} Error updating entry:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { entryId: string } }) {
  const routeLogName = `${routeNamePrefix} DELETE /api/manual-entries/${params.entryId}`;
  try {
    const { db } = await connectToDatabase();
    const { entryId } = params;
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId || !entryId) {
      return NextResponse.json({ success: false, message: 'Company ID and entry ID are required.' }, { status: 400 });
    }

    const entryToDelete = await db.collection<ManualEntry>('manual_entries').findOne({ id: entryId, companyId });
    if (!entryToDelete) {
      return NextResponse.json({ success: false, message: 'Entry not found.' }, { status: 404 });
    }

    const result = await db.collection<ManualEntry>('manual_entries').deleteOne({ id: entryId, companyId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Entry not found for deletion.' }, { status: 404 });
    }

    console.log(`${routeLogName} Deleted entry ${entryId} for company ${companyId}.`);
    return NextResponse.json({ success: true, message: 'Entry deleted successfully.' });
  } catch (error) {
    console.error(`${routeLogName} Error deleting entry:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}