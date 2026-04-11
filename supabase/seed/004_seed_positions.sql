-- ============================================================
-- Seed: 004_seed_positions.sql
-- Description: Pre-loaded job title / position library (≥100 entries)
--              Grouped by industry. Supports zh/en bilingual display.
--              Per PARALLEL_C2 T-C2-2 spec.
-- Safe to re-run: ON CONFLICT (name_zh) DO NOTHING
-- ============================================================

INSERT INTO seed_positions (name_zh, name_en, industry, sort_order) VALUES

-- ── 互联网 / 科技 (tech) ────────────────────────────────────────────────────
('软件工程师',            'Software Engineer',                   'tech',          1),
('高级软件工程师',        'Senior Software Engineer',            'tech',          2),
('前端工程师',            'Frontend Engineer',                   'tech',          3),
('后端工程师',            'Backend Engineer',                    'tech',          4),
('全栈工程师',            'Full Stack Engineer',                 'tech',          5),
('移动端工程师',          'Mobile Engineer',                     'tech',          6),
('iOS 工程师',            'iOS Engineer',                        'tech',          7),
('Android 工程师',        'Android Engineer',                    'tech',          8),
('算法工程师',            'Algorithm Engineer',                  'tech',          9),
('机器学习工程师',        'Machine Learning Engineer',           'tech',         10),
('AI 工程师',             'AI Engineer',                        'tech',         11),
('数据科学家',            'Data Scientist',                      'tech',         12),
('数据分析师',            'Data Analyst',                        'tech',         13),
('数据工程师',            'Data Engineer',                       'tech',         14),
('DevOps 工程师',         'DevOps Engineer',                     'tech',         15),
('云架构师',              'Cloud Architect',                     'tech',         16),
('系统架构师',            'System Architect',                    'tech',         17),
('安全工程师',            'Security Engineer',                   'tech',         18),
('QA 工程师',             'QA Engineer',                         'tech',         19),
('技术负责人',            'Tech Lead',                           'tech',         20),
('研发总监',              'R&D Director',                        'tech',         21),
('首席技术官',            'Chief Technology Officer (CTO)',       'tech',         22),
('产品经理',              'Product Manager',                     'tech',         23),
('高级产品经理',          'Senior Product Manager',              'tech',         24),
('产品总监',              'Product Director',                    'tech',         25),
('技术产品经理',          'Technical Product Manager',           'tech',         26),
('增长产品经理',          'Growth Product Manager',              'tech',         27),
('UI/UX 设计师',          'UI/UX Designer',                      'tech',         28),
('交互设计师',            'Interaction Designer',                'tech',         29),
('运维工程师',            'Operations Engineer',                 'tech',         30),
('SRE 工程师',            'Site Reliability Engineer (SRE)',      'tech',         31),
('嵌入式工程师',          'Embedded Systems Engineer',           'tech',         32),
('网络工程师',            'Network Engineer',                    'tech',         33),

-- ── 金融 / 投资 (finance) ──────────────────────────────────────────────────
('投资分析师',            'Investment Analyst',                  'finance',       1),
('股票研究员',            'Equity Research Analyst',             'finance',       2),
('量化分析师',            'Quantitative Analyst',                'finance',       3),
('风险管理经理',          'Risk Management Manager',             'finance',       4),
('财务分析师',            'Financial Analyst',                   'finance',       5),
('财务总监',              'Chief Financial Officer (CFO)',        'finance',       6),
('财务经理',              'Finance Manager',                     'finance',       7),
('会计',                  'Accountant',                          'finance',       8),
('审计师',                'Auditor',                             'finance',       9),
('基金经理',              'Fund Manager',                        'finance',      10),
('私募股权分析师',        'Private Equity Analyst',              'finance',      11),
('风险投资分析师',        'Venture Capital Analyst',             'finance',      12),
('投行分析师',            'Investment Banking Analyst',          'finance',      13),
('合规专员',              'Compliance Officer',                  'finance',      14),
('保险精算师',            'Actuary',                             'finance',      15),
('信贷分析师',            'Credit Analyst',                      'finance',      16),
('资产管理经理',          'Asset Management Manager',            'finance',      17),
('证券交易员',            'Securities Trader',                   'finance',      18),

-- ── 市场营销 (marketing) ──────────────────────────────────────────────────
('市场营销经理',          'Marketing Manager',                   'marketing',     1),
('品牌经理',              'Brand Manager',                       'marketing',     2),
('数字营销专员',          'Digital Marketing Specialist',        'marketing',     3),
('内容运营',              'Content Operations',                  'marketing',     4),
('社交媒体运营',          'Social Media Manager',                'marketing',     5),
('SEO/SEM 专员',          'SEO/SEM Specialist',                  'marketing',     6),
('市场总监',              'Marketing Director',                  'marketing',     7),
('增长黑客',              'Growth Hacker',                       'marketing',     8),
('公关专员',              'Public Relations Specialist',         'marketing',     9),
('用户运营',              'User Operations Manager',             'marketing',    10),
('电商运营',              'E-commerce Operations',               'marketing',    11),
('市场研究分析师',        'Market Research Analyst',             'marketing',    12),

-- ── 销售 (sales) ──────────────────────────────────────────────────────────
('销售代表',              'Sales Representative',                'sales',         1),
('大客户销售',            'Key Account Manager',                 'sales',         2),
('销售经理',              'Sales Manager',                       'sales',         3),
('销售总监',              'Sales Director',                      'sales',         4),
('商务拓展经理',          'Business Development Manager',        'sales',         5),
('解决方案工程师',        'Solutions Engineer',                  'sales',         6),
('售前顾问',              'Pre-sales Consultant',                'sales',         7),
('渠道销售经理',          'Channel Sales Manager',               'sales',         8),
('客户成功经理',          'Customer Success Manager',            'sales',         9),

-- ── 人力资源 (hr) ─────────────────────────────────────────────────────────
('人力资源专员',          'HR Specialist',                       'hr',            1),
('招聘专员',              'Recruiter',                           'hr',            2),
('人力资源经理',          'HR Manager',                          'hr',            3),
('人力资源总监',          'HR Director',                         'hr',            4),
('HRBP',                  'HR Business Partner (HRBP)',           'hr',            5),
('薪酬福利专员',          'Compensation & Benefits Specialist',  'hr',            6),
('培训与发展专员',        'Learning & Development Specialist',   'hr',            7),
('组织发展顾问',          'Organizational Development Consultant','hr',            8),

-- ── 教育 (education) ──────────────────────────────────────────────────────
('教师',                  'Teacher',                             'education',     1),
('高校教师 / 讲师',       'University Lecturer',                 'education',     2),
('课程设计师',            'Instructional Designer',              'education',     3),
('教育产品经理',          'Education Product Manager',           'education',     4),
('教学研究员',            'Education Researcher',                'education',     5),
('在线教育运营',          'Online Education Operations',         'education',     6),

-- ── 医疗健康 (healthcare) ─────────────────────────────────────────────────
('医生',                  'Physician',                           'healthcare',    1),
('护士',                  'Nurse',                               'healthcare',    2),
('医疗器械销售',          'Medical Device Sales',                'healthcare',    3),
('医疗数据分析师',        'Healthcare Data Analyst',             'healthcare',    4),
('医院管理员',            'Hospital Administrator',              'healthcare',    5),
('药剂师',                'Pharmacist',                          'healthcare',    6),
('生物医学工程师',        'Biomedical Engineer',                 'healthcare',    7),
('医疗软件工程师',        'Health Informatics Engineer',         'healthcare',    8),

-- ── 咨询 / 服务 (consulting) ──────────────────────────────────────────────
('管理咨询顾问',          'Management Consultant',               'consulting',    1),
('战略咨询顾问',          'Strategy Consultant',                 'consulting',    2),
('IT 咨询顾问',           'IT Consultant',                       'consulting',    3),
('项目经理',              'Project Manager',                     'consulting',    4),
('高级项目经理',          'Senior Project Manager',              'consulting',    5),
('项目总监',              'Program Director',                    'consulting',    6),
('运营总监',              'Chief Operating Officer (COO)',        'consulting',    7),
('业务分析师',            'Business Analyst',                    'consulting',    8),

-- ── 制造 / 工程 (manufacturing) ──────────────────────────────────────────
('机械工程师',            'Mechanical Engineer',                 'manufacturing', 1),
('电气工程师',            'Electrical Engineer',                 'manufacturing', 2),
('工业工程师',            'Industrial Engineer',                 'manufacturing', 3),
('供应链经理',            'Supply Chain Manager',                'manufacturing', 4),
('采购经理',              'Procurement Manager',                 'manufacturing', 5),
('质量工程师',            'Quality Engineer',                    'manufacturing', 6),
('生产主管',              'Production Supervisor',               'manufacturing', 7),
('精益制造工程师',        'Lean Manufacturing Engineer',         'manufacturing', 8),

-- ── 法律 (legal) ──────────────────────────────────────────────────────────
('律师',                  'Lawyer / Attorney',                   'legal',         1),
('法务经理',              'Legal Affairs Manager',               'legal',         2),
('合同专员',              'Contract Specialist',                 'legal',         3),
('知识产权专员',          'Intellectual Property Specialist',    'legal',         4),

-- ── 设计 (design) ─────────────────────────────────────────────────────────
('平面设计师',            'Graphic Designer',                    'design',        1),
('品牌设计师',            'Brand Designer',                      'design',        2),
('视觉设计师',            'Visual Designer',                     'design',        3),
('产品设计师',            'Product Designer',                    'design',        4),
('用户体验研究员',        'UX Researcher',                       'design',        5),
('动效设计师',            'Motion Designer',                     'design',        6),
('工业设计师',            'Industrial Designer',                 'design',        7)

ON CONFLICT (name_zh) DO NOTHING;

-- Verify minimum count (reference only — not executable constraint):
-- SELECT count(*) FROM seed_positions; -- expected ≥ 100
