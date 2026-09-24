-- StockFlow Supabase Migration 006
-- WhatsApp integration: connection meta, CRM contacts, message history, campaigns

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WHATSAPP CONNECTIONS (per company metadata; session creds stay on disk)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  phone_number TEXT,
  qr TEXT,
  qr_expires_at BIGINT,
  last_error TEXT,
  auto_send_bill BOOLEAN NOT NULL DEFAULT false,
  connected_at TEXT,
  disconnected_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

-- ============================================================
-- WHATSAPP CONTACTS (CRM, auto-upserted from billed phone numbers)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  last_bill_id TEXT,
  last_bill_date TEXT,
  total_bills NUMERIC NOT NULL DEFAULT 1,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  message_count NUMERIC NOT NULL DEFAULT 0,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_company ON whatsapp_contacts(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_company_phone ON whatsapp_contacts(company_id, phone);

-- ============================================================
-- WHATSAPP MESSAGES (history for CRM + chat view)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'out',
  kind TEXT NOT NULL DEFAULT 'manual',
  text TEXT NOT NULL,
  bill_id TEXT,
  status TEXT,
  error TEXT,
  campaign_id TEXT,
  timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company_phone
  ON whatsapp_messages(company_id, contact_phone, timestamp DESC);

-- ============================================================
-- WHATSAPP CAMPAIGNS (promotional broadcasts)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  sent_count NUMERIC NOT NULL DEFAULT 0,
  total_count NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_company ON whatsapp_campaigns(company_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON whatsapp_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON whatsapp_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON whatsapp_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON whatsapp_campaigns FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon read access" ON whatsapp_connections FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON whatsapp_contacts FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON whatsapp_messages FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON whatsapp_campaigns FOR SELECT USING (true);