-- Phase 4.1: DeepSeek-assisted prospect analysis metadata.
ALTER TABLE prospect_searches ADD COLUMN analysis_mode TEXT NOT NULL DEFAULT 'rules';
ALTER TABLE prospect_candidates ADD COLUMN analysis_mode TEXT NOT NULL DEFAULT 'rules';
ALTER TABLE prospect_candidates ADD COLUMN ai_analysis TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN analysis_mode TEXT NOT NULL DEFAULT 'rules';
ALTER TABLE leads ADD COLUMN ai_analysis TEXT NOT NULL DEFAULT '';
