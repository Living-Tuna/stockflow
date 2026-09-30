-- StockFlow Supabase Migration 007
-- Sale returns / exchanges: bill-level settlement columns.
--
-- The return & exchange logic (src/lib/return-utils.ts) and the write path
-- (src/app/api/bills/route.ts) have referenced these fields since returns were
-- introduced, but the columns were never added to the schema. Every return save
-- therefore failed with:
--   "bill save failed: could not find the original bill id column of bills in
--    the schema cache"
-- (PostgREST resolves camelCase -> original_bill_id, which did not exist.)
--
-- Per-line tracking (returned_quantity, exchanged_quantity,
-- defective_returned_quantity, ...) lives inside the existing `items` JSONB
-- column and needs no change. Only bill-level fields are added here.

-- The sale bill a return/exchange settles against.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS original_bill_id TEXT;

-- 'return' = money credited back, 'exchange' = like-for-like swap, no money.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS return_type TEXT;

-- On a return bill: the amount credited back to the customer (excludes
-- exchange lines, which move no money).
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;

-- On the ORIGINAL sale bill: running total already refunded, so
-- getNetBillAmount() can show the amount the customer actually still owes.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0;

-- Ids of the return/exchange bills recorded against a sale bill.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS linked_return_bill_ids JSONB NOT NULL DEFAULT '[]';

-- Lookups run on every "which bills can I return against?" query.
CREATE INDEX IF NOT EXISTS idx_bills_company_original_bill_id
  ON bills(company_id, original_bill_id);

-- Guard the settlement semantics in the database, so a bad write can't leave
-- the ledger inconsistent (e.g. a return that claims a non-existent parent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bills_return_type_check' AND conrelid = 'bills'::regclass
  ) THEN
    ALTER TABLE bills ADD CONSTRAINT bills_return_type_check
      CHECK (return_type IS NULL OR return_type IN ('return', 'exchange'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bills_amounts_non_negative' AND conrelid = 'bills'::regclass
  ) THEN
    ALTER TABLE bills ADD CONSTRAINT bills_amounts_non_negative
      CHECK (
        (refund_amount IS NULL OR refund_amount >= 0) AND
        (refunded_amount IS NULL OR refunded_amount >= 0)
      );
  END IF;
END $$;
