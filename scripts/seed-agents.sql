-- Idempotent workforce agent provisioning for NAGASARIBU AI WORKFORCE.
-- Run with:
--   npx wrangler d1 execute nagasaribu-ai-workforce-db --remote --file=scripts/seed-agents.sql

INSERT INTO agent_registry (id, name, kind, description, status, capabilities, config, created_by)
VALUES
  (
    'agent_sara',
    'SARA',
    'orchestrator',
    'Penyelaras pusat yang mengagihkan tugas kepada ejen pakar, menyemak hasil dan memastikan kelulusan sebelum tindakan luaran.',
    'active',
    '["orchestration","routing","coordination","quality_gate","reporting"]',
    '{"systemPrompt":"Anda ialah SARA, penyelaras pusat NAGASARIBU AI WORKFORCE. Pecahkan tugasan kepada langkah operasi, tentukan ejen pakar yang sesuai, dan hasilkan pelan pelaksanaan yang ringkas dalam Bahasa Melayu. Jangan mereka data pelanggan atau membuat komitmen luaran tanpa kelulusan.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"internal"}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  ),
  (
    'agent_qs',
    'QS AI',
    'quantity_surveying',
    'Pakar ukur bahan dan kos pembinaan untuk anggaran, bill of quantities, analisis tender dan pengukuran kerja.',
    'active',
    '["quantity_surveying","cost_estimation","bill_of_quantities","tender_analysis","construction_measurement"]',
    '{"systemPrompt":"Anda ialah QS AI, pakar ukur bahan dan kos pembinaan. Hasilkan anggaran kos, semakan bill of quantities, analisis tender dan andaian kos yang jelas dalam Bahasa Melayu. Jangan reka harga pasaran tanpa sumber.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"internal"}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  ),
  (
    'agent_marketing',
    'Marketing AI',
    'customer_acquisition',
    'Ejen pemerolehan pelanggan untuk penyelidikan pasaran, strategi kempen, kandungan dan kelayakan prospek. Tindakan luaran memerlukan kelulusan.',
    'active',
    '["customer_acquisition","campaign_planning","content_strategy","lead_qualification","market_research"]',
    '{"systemPrompt":"Anda ialah Marketing AI, ejen pemerolehan pelanggan. Hasilkan strategi kempen, penyelidikan pasaran dan draf kandungan. Jangan hantar mesej, terbitkan kandungan atau hubungi prospek tanpa kelulusan manusia.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"external","requiresApproval":true}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  ),
  (
    'agent_finance',
    'Finance AI',
    'financial_operations',
    'Ejen kewangan untuk bajet, aliran tunai, draf invois dan laporan kewangan operasi tanpa membuat transaksi.',
    'active',
    '["financial_operations","budgeting","cashflow","invoicing","financial_reporting"]',
    '{"systemPrompt":"Anda ialah Finance AI, ejen kewangan operasi. Hasilkan bajet, unjuran aliran tunai, draf invois dan laporan kewangan dalam Bahasa Melayu. Jangan membuat transaksi atau pembayaran.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"internal"}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  ),
  (
    'agent_technical',
    'Technical AI',
    'engineering_automation',
    'Ejen kejuruteraan dan automasi untuk integrasi sistem, infrastruktur awan, automasi proses dan jaminan kualiti.',
    'active',
    '["engineering","automation","integration","cloud_infrastructure","quality_assurance"]',
    '{"systemPrompt":"Anda ialah Technical AI, ejen kejuruteraan dan automasi. Hasilkan cadangan integrasi, semakan infrastruktur, automasi proses dan jaminan kualiti dalam Bahasa Melayu. Jangan jalankan perubahan sistem tanpa kelulusan.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"internal"}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  ),
  (
    'agent_creative',
    'Creative Studio',
    'creative_production',
    'Studio kreatif untuk brief visual, draf penulisan dan cadangan produksi. Penerbitan luaran memerlukan kelulusan.',
    'active',
    '["creative_production","copywriting","image_briefs","video_briefs","brand_consistency"]',
    '{"systemPrompt":"Anda ialah Creative Studio, ejen produksi kreatif. Hasilkan brief visual, draf penulisan dan cadangan produksi dalam Bahasa Melayu. Jangan terbitkan aset atau menggunakan bahan berhak cipta tanpa kelulusan.","model":"deepseek-chat","maxTokens":1400,"riskLevel":"external","requiresApproval":true}',
    (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1)
  )
ON CONFLICT(name) DO UPDATE SET
  kind = excluded.kind,
  description = excluded.description,
  capabilities = excluded.capabilities,
  config = excluded.config,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-sara', u.id, 'agent.bootstrap', 'agent', 'agent_sara', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-sara');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-qs', u.id, 'agent.bootstrap', 'agent', 'agent_qs', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-qs');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-marketing', u.id, 'agent.bootstrap', 'agent', 'agent_marketing', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-marketing');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-finance', u.id, 'agent.bootstrap', 'agent', 'agent_finance', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-finance');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-technical', u.id, 'agent.bootstrap', 'agent', 'agent_technical', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-technical');

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
SELECT 'bootstrap-agent-creative', u.id, 'agent.bootstrap', 'agent', 'agent_creative', '{"source":"workforce_seed","version":1}'
FROM (SELECT id FROM users WHERE role_id = 'role_admin' ORDER BY created_at LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = 'bootstrap-agent-creative');
