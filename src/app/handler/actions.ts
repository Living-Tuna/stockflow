
'use server';

import { connectToDatabase } from '@/lib/db';
import type { Company, SubscriptionType, User } from '@/types';
import { add } from 'date-fns';

const HANDLER_ADMIN_EMAIL = (process.env.HANDLER_ADMIN_EMAIL || '4lfasbadar@gmail.com').toLowerCase();

export async function verifyHandlerAccess(userId?: string | null): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: 'You must be signed in as an admin to access the Subscription Handler.' };
  }

  try {
    const { db } = await connectToDatabase();
    const user = await db.collection<User>('users').findOne({ id: userId });

    if (!user) {
      return { success: false, error: 'Signed-in account not found. Please log in again.' };
    }

    const userEmail = (user.email || '').toLowerCase();
    if (userEmail !== HANDLER_ADMIN_EMAIL) {
      return { success: false, error: `Access denied: ${userEmail || 'your account'} is not authorized to use the Subscription Handler.` };
    }

    return { success: true };
  } catch (e) {
    console.error("Failed to verify handler access:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Failed to verify access: ${message}` };
  }
}

export async function getCustomers(): Promise<{ company: Company; admin: User | null }[]> {
  const { db } = await connectToDatabase();
  const companies = await db.collection<Company>('companies').find().sort({ paymentStatus: 1, name: 1 }).toArray();
  
  const results = await Promise.all(companies.map(async (company) => {
    const admin = await db.collection<User>('users').findOne({ companyId: company.id, role: 'admin' });
    return { company, admin };
  }));

  return results;
}

export async function markAsPaid(companyId: string, subscriptionType: SubscriptionType): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    
    const expiryDate = subscriptionType === 'yearly'
      ? add(now, { years: 1 })
      : add(now, { months: 1 });
    
    expiryDate.setHours(23, 59, 59, 999);

    const result = await db.collection<Company>('companies').updateOne(
      { id: companyId },
      { 
        $set: { 
          paymentStatus: 'paid',
          subscriptionType,
          subscriptionStartDate: now.toISOString(),
          subscriptionExpiryDate: expiryDate.toISOString(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Company not found.' };
    }

    return { success: true };
  } catch (e) {
    console.error("Failed to update company in markAsPaid:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Failed to save update to database: ${message}` };
  }
}

export async function approveSubscriptionChange(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await connectToDatabase();
    const company = await db.collection<Company>('companies').findOne({ id: companyId });
    
    if (!company) return { success: false, error: 'Company not found.' };
    if (!company.pendingSubscriptionId) return { success: false, error: 'No pending subscription to approve.' };

    const result = await db.collection<Company>('companies').updateOne(
      { id: companyId },
      { 
        $set: { activeSubscriptionId: company.pendingSubscriptionId },
        $unset: { pendingSubscriptionId: "" }
      }
    );

    if (result.matchedCount === 0) return { success: false, error: 'Failed to update company.' };

    return { success: true };
  } catch (e) {
    console.error("Failed to approve subscription:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Failed to approve: ${message}` };
  }
}

export async function rejectSubscriptionChange(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await connectToDatabase();
    
    const result = await db.collection<Company>('companies').updateOne(
      { id: companyId },
      { $unset: { pendingSubscriptionId: "" } }
    );

    if (result.matchedCount === 0) return { success: false, error: 'Company not found.' };

    return { success: true };
  } catch (e) {
    console.error("Failed to reject subscription:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Failed to reject: ${message}` };
  }
}
