-- StockFlow Migration
-- Add early bird discount columns to companies

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC;

CREATE INDEX IF NOT EXISTS idx_companies_discount_code ON companies(discount_code);