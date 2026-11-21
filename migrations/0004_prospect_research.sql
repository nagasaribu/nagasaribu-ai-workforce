-- Phase 4: customer acquisition research and reviewed CRM import.

ALTER TABLE leads ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]';
ALTER TABLE leads ADD COLUMN retrieved_at TEXT;
ALTER TABLE leads ADD COLUMN qualification_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN qualification_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN missing_info TEXT NOT NULL DEFAULT '[]';
ALTER TABLE leads ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1));
ALTER TABLE leads ADD COLUMN follow_up_at TEXT;
ALTER TABLE leads ADD COLUMN marketing_draft TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN dedupe_key TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX idx_leads_dedupe ON leads(dedupe_key) WHERE dedupe_key <> '';

INSERT INTO lead_sources (id, name, channel, description)
VALUES ('source_exa', 'Exa Web Search', 'web_search', 'Hasil carian awam melalui Exa')
ON CONFLICT(id) DO NOTHING;

CREATE TABLE prospect_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  service TEXT NOT NULL,
  location TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'exa',
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'unavailable', 'error')),
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_prospect_searches_user ON prospect_searches(user_id, created_at);
CREATE INDEX idx_prospect_searches_created ON prospect_searches(created_at);

CREATE TABLE prospect_candidates (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES prospect_searches(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '[]',
  retrieved_at TEXT NOT NULL,
  qualification_score INTEGER NOT NULL DEFAULT 0,
  qualification_notes TEXT NOT NULL DEFAULT '',
  missing_info TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'imported', 'rejected')),
  imported_lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  draft_whatsapp TEXT NOT NULL DEFAULT '',
  draft_email_subject TEXT NOT NULL DEFAULT '',
  draft_email_body TEXT NOT NULL DEFAULT '',
  draft_proposal TEXT NOT NULL DEFAULT '',
  draft_analysis TEXT NOT NULL DEFAULT '',
  draft_mode TEXT,
  drafted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_candidates_search_dedupe ON prospect_candidates(search_id, dedupe_key);
CREATE INDEX idx_candidates_status ON prospect_candidates(status, created_at);
CREATE INDEX idx_candidates_search ON prospect_candidates(search_id);
