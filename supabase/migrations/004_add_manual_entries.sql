-- StockFlow Supabase Migration 004
-- Table: manual_entries (additional company income / expenses / opening balances)

CREATE TABLE IF NOT EXISTS manual_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id TEXT,
  date TEXT NOT NULL,                 -- ISO date (YYYY-MM-DD)
  entry_type TEXT NOT NULL,           -- 'income' | 'expense' | 'opening_balance'
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_manual_entries_company_date ON manual_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_manual_entries_company_store_date ON manual_entries(company_id, store_id, date);

ALTER TABLE manual_entries ENABLE ROW LEVEL SECURITY;

-- Grant table access to Supabase roles (service_role manages data via admin SDK; anon/authenticated read)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_entries TO service_role;
GRANT SELECT ON public.manual_entries TO anon, authenticated;

-- Service role bypass (server actions / admin SDK)
CREATE POLICY "Service role full access" ON manual_entries FOR ALL USING (true) WITH CHECK (true);

-- Anon read access (client-side queries if needed)
CREATE POLICY "Anon read access" ON manual_entries FOR SELECT USING (true);