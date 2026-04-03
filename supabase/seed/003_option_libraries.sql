-- ============================================
-- Seed: 003_option_libraries.sql
-- Description: Option libraries for industries, skills, etc.
-- Note: option_libraries table is created in migration 20260331000001_initial_schema.sql
-- ============================================

INSERT INTO option_libraries (category, label_zh, label_en, value, sort_order, is_active)
VALUES
  -- Industries
  ('industry', '互联网/科技', 'Technology', 'tech', 1, true),
  ('industry', '金融/投资', 'Finance & Investment', 'finance', 2, true),
  ('industry', '教育', 'Education', 'education', 3, true),
  ('industry', '医疗健康', 'Healthcare', 'healthcare', 4, true),
  ('industry', '消费/零售', 'Consumer & Retail', 'consumer', 5, true),
  ('industry', '制造业', 'Manufacturing', 'manufacturing', 6, true),
  ('industry', '咨询/服务', 'Consulting & Services', 'consulting', 7, true),
  ('industry', '媒体/内容', 'Media & Content', 'media', 8, true),
  ('industry', '政府/非营利', 'Government & Non-profit', 'government', 9, true),
  ('industry', '其他', 'Other', 'other', 10, true),

  -- Work types
  ('work_type', '现场办公', 'On-site', 'onsite', 1, true),
  ('work_type', '远程办公', 'Remote', 'remote', 2, true),
  ('work_type', '混合办公', 'Hybrid', 'hybrid', 3, true),

  -- Resume templates
  ('resume_template', '现代简洁', 'Modern Clean', 'modern_clean', 1, true),
  ('resume_template', '专业经典', 'Professional Classic', 'professional_classic', 2, true),
  ('resume_template', '创意设计', 'Creative Design', 'creative_design', 3, true)

ON CONFLICT DO NOTHING;
