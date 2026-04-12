// Core domain types for CareerFlow

export type PaymentMarket = 'cn_free' | 'en_paid'
export type ResumeLang = 'zh' | 'en' | 'bilingual'
export type AchievementStatus = 'draft' | 'confirmed' | 'ignored'
export type AchievementTier = 1 | 2 | 3
export type AchievementSource = 'upload' | 'notion' | 'manual'
export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type SyncType = 'manual' | 'webhook' | 'scheduled'
export type PaymentProvider = 'creem' | 'stripe'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance' | 'volunteer'
export type CompanySize  = '<50' | '50-200' | '200-1000' | '1000-5000' | '>5000'
export type CompanyType  = 'public' | 'private' | 'startup' | 'soe' | 'ngo' | 'government' | 'fortune500' | 'other'
export type ImpactCategory = 'revenue' | 'cost' | 'efficiency' | 'scale' | 'quality' | 'team' | 'product' | 'process' | 'other'
export type DegreeType   = 'high_school' | 'associate' | 'bachelor' | 'master' | 'mba' | 'phd' | 'jd' | 'md' | 'certificate' | 'other'
export type SkillCategory = 'programming_language' | 'framework' | 'tool' | 'soft_skill' | 'domain_knowledge' | 'other'
export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type LanguageProficiency = 'elementary' | 'limited_working' | 'professional_working' | 'full_professional' | 'native_bilingual'
export type WorkAuthorization = 'citizen' | 'permanent_resident' | 'visa_h1b' | 'visa_other' | 'not_required'
export type PubType   = 'journal' | 'conference' | 'book' | 'book_chapter' | 'patent' | 'white_paper' | 'report' | 'blog' | 'other'
export type PubStatus = 'published' | 'accepted' | 'under_review' | 'preprint' | 'in_preparation'

export interface Profile {
  id: string
  payment_market: PaymentMarket
  /** true once user explicitly confirmed market in MarketConfirmModal (write-once) */
  payment_market_confirmed: boolean
  signup_geo_country: string | null
  resume_lang_preference: ResumeLang
  photo_path: string | null
  photo_show_toggle: boolean
  notion_access_token: string | null
  notion_workspace_id: string | null
  notion_connected_at: string | null
  // Fortune 500 resume fields
  full_name: string | null
  professional_headline: string | null
  work_authorization: WorkAuthorization | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  created_at: string
  updated_at: string
}

export interface WorkExperience {
  id: string
  user_id: string | null
  anonymous_id: string | null
  company: string
  job_title: string
  industry: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  sort_order: number
  original_tenure: string | null
  original_section_order: number | null
  location: string | null
  department: string | null
  work_type: string | null
  description: string | null
  // Fortune 500 resume fields
  start_month: number | null
  end_month: number | null
  employment_type: EmploymentType | null
  company_size: CompanySize | null
  company_type: CompanyType | null
  team_size: number | null
  direct_reports: number | null
  budget_managed: string | null
  reporting_to_title: string | null
  created_at: string
  updated_at: string
  // Loaded relations
  achievements?: Achievement[]
}

export interface Achievement {
  id: string
  experience_id: string
  text: string
  status: AchievementStatus
  tier: AchievementTier
  has_placeholders: boolean
  ai_score: number | null
  source: AchievementSource
  notion_task_id: string | null
  sort_order: number
  /** 所属子项目名称；null = 直接挂在工作经历下，无具体子项目 */
  project_name: string | null
  /** 候选人在该子项目中的角色（如"技术负责人"），区别于公司层面的 job_title */
  project_member_role: string | null
  // Fortune 500 resume fields
  /** AI美化前的原始bullet文本，F1路径保存；F2路径使用 original_notion_text */
  original_text: string | null
  /** 成就影响类别，用于诊断报告和可视化 */
  impact_category: ImpactCategory | null
  /** 精选标记：简历生成时优先入选，成就库置顶展示 */
  is_featured: boolean
  /** ATS关键词数组，AI提取，供JD相似度匹配 */
  keywords: string[] | null
  created_at: string
  updated_at: string
}

export interface ResumeVersion {
  id: string
  user_id: string | null
  anonymous_id: string | null
  editor_json: object
  photo_path: string | null
  show_photo: boolean
  template_key: string
  snapshot_label: string | null
  snapshot_jd: string | null
  resume_lang: ResumeLang
  is_auto_save: boolean
  created_at: string
}

export interface ResumeUpload {
  id: string
  user_id: string | null
  anonymous_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number | null
  raw_text: string | null
  photo_extracted_path: string | null
  parse_status: ParseStatus
  parse_error: string | null
  created_at: string
}

export interface PaywallSettings {
  id: string
  market: PaymentMarket
  is_enabled: boolean
  trigger_event: string
  price_usd: number | null
  payment_provider: PaymentProvider | null
  plan_type: string | null
  config: Record<string, unknown>
  updated_at: string
}

export interface PromptConfig {
  id: string
  task: string
  market: 'cn' | 'en'
  prompt_text: string
  model_override: string | null
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string | null
  provider: PaymentProvider
  provider_payment_id: string | null
  plan_type: string
  amount_usd: number | null
  currency: string
  status: PaymentStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// AI related
export type AITask =
  | 'resume_beautify'
  | 'resume_structure_extract'
  | 'resume_achievement_beautify'
  | 'jd_parse'
  | 'achievement_extract'
  | 'achievement_match'
  | 'resume_translate'
  | 'resume_profile_translate'
  | 'resume_summary_generate'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICallOptions {
  task: AITask
  messages: AIMessage[]
  market: 'cn' | 'en'
  timeout?: number
}

// Resume beautify output

export interface ResumePersonalInfo {
  name: string
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
  github: string | null
  website: string | null
  summary: string | null
  work_authorization: string | null
}

export interface ResumeEducation {
  school: string
  degree: string | null
  /** 主修专业 */
  major: string | null
  /** 辅修专业 */
  minor_subject: string | null
  start_year: number | null
  end_year: number | null
  /** 绩点分数，原文逐字复制，如 "3.8" 或 "3.85" */
  gpa_score: string | null
  /** 绩点满分制，如 "4.0"、"5.0"、"100" */
  gpa_scale: string | null
  /** 班级/专业排名，原文逐字复制，如 "前5%"、"班级第3名(3/50)" */
  class_rank_text: string | null
  /** 奖学金/荣誉，如 "国家奖学金 2021, 2022" */
  academic_honors: string | null
  // Fortune 500 additions
  thesis_title: string | null
  activities: string | null
  study_abroad: string | null
}

export interface ResumeSkillGroup {
  category: string
  items: string[]
}

export interface BeautifyOutput {
  personal_info: ResumePersonalInfo
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  experiences: BeautifyExperience[]
}

export interface BeautifyExperience {
  company: string
  job_title: string
  start_year: number | null
  start_month: number | null   // 1-12, null if not available
  end_year: number | null
  end_month: number | null     // 1-12, null if not available
  is_current: boolean
  achievements: BeautifyAchievement[]
}

export interface BeautifyAchievement {
  text: string
  tier: AchievementTier
  has_placeholders: boolean
  /** 所属子项目名称；null = 直接挂在工作经历下 */
  project_name: string | null
  /** 候选人在该子项目中的具体角色 */
  project_member_role: string | null
}

// Two-call AI: intermediate structure extraction output

/** 工作经历下的一个具体子项目（或无项目时的默认分组） */
export interface RawStructureProject {
  /** 子项目名称；无具体子项目时为 null */
  project_name: string | null
  /** 候选人在该子项目中的角色；无时为 null */
  project_member_role: string | null
  /** 项目背景/描述（1-2句），可为 null */
  project_description: string | null
  /** 该项目下的原始成就/职责条目，逐字复制 */
  raw_bullets: string[]
}

export interface RawStructureExperience {
  /** 雇主/用人单位全名（非项目名） */
  company: string
  /** 候选人在该公司的职位名称 */
  job_title: string
  start_year: number | null
  start_month: number | null
  end_year: number | null
  end_month: number | null
  is_current: boolean
  // Fortune 500 additions (AI extracts if mentioned in resume)
  employment_type: EmploymentType | null
  company_size: CompanySize | null
  team_size: number | null
  direct_reports: number | null
  budget_managed: string | null
  /**
   * 该工作经历下的项目列表。
   * 若无具体子项目，则仅一个条目且 project_name=null。
   * 若有多个子项目，则每个子项目一个条目。
   */
  projects: RawStructureProject[]
}

// Raw parse: new extracted sections
export interface RawCertification {
  name: string
  issuing_org: string | null
  issue_year: number | null
  issue_month: number | null
  expiry_year: number | null
  credential_id: string | null
}

export interface RawSpokenLanguage {
  language_name: string
  proficiency: LanguageProficiency
  is_native: boolean
}

export interface RawAward {
  title: string
  issuing_org: string | null
  award_year: number | null
  description: string | null
}

export interface RawPublication {
  title: string
  pub_type: PubType
  authors: string[] | null
  author_position: number | null
  publication_venue: string | null
  pub_year: number | null
  pub_month: number | null
  doi: string | null
  patent_number: string | null
  url: string | null
  status: PubStatus
  description: string | null
}

export interface RawStructureOutput {
  personal_info: ResumePersonalInfo
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  experiences: RawStructureExperience[]
  certifications: RawCertification[]
  spoken_languages: RawSpokenLanguage[]
  awards: RawAward[]
  publications: RawPublication[]
}

// Two-call AI: achievement beautification input/output
export interface AchievementBeautifyInput {
  index: number    // global bullet index, used to map back
  raw: string      // verbatim bullet text from structure extraction
}

export interface AchievementBeautifyResult {
  index: number
  text: string
  tier: AchievementTier
  has_placeholders: boolean
}

// JD parse output
export interface JDParseOutput {
  role: string
  key_skills: string[]
  key_responsibilities: string[]
  seniority: 'junior' | 'mid' | 'senior' | 'lead'
  industry: string
}

// ─── Fortune 500 Resume Entity Types ─────────────────────────────────────────

/** 独立教育经历实体（对应 education 表） */
export interface Education {
  id: string
  user_id: string | null
  anonymous_id: string | null
  institution_name: string
  degree_type: DegreeType | null
  field_of_study: string | null
  minor_field: string | null
  start_year: number | null
  end_year: number | null
  is_current: boolean
  gpa_score: number | null
  gpa_scale: number | null
  class_rank_text: string | null
  academic_honors: string | null
  thesis_title: string | null
  activities: string | null
  study_abroad: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/** 独立技能实体（对应 user_skills 表） */
export interface UserSkill {
  id: string
  user_id: string | null
  anonymous_id: string | null
  skill_name: string
  category: SkillCategory
  proficiency_level: SkillProficiency
  years_of_experience: number | null
  is_featured: boolean
  sort_order: number
  created_at: string
}

/** 证书资质实体（对应 certifications 表） */
export interface Certification {
  id: string
  user_id: string | null
  anonymous_id: string | null
  name: string
  issuing_org: string | null
  issue_year: number | null
  issue_month: number | null
  expiry_year: number | null
  expiry_month: number | null
  is_current: boolean
  credential_id: string | null
  verification_url: string | null
  sort_order: number
  created_at: string
}

/** 口语语言能力实体（对应 spoken_languages 表） */
export interface SpokenLanguage {
  id: string
  user_id: string | null
  anonymous_id: string | null
  language_name: string
  proficiency: LanguageProficiency
  is_native: boolean
  sort_order: number
  created_at: string
}

/** 奖项荣誉实体（对应 awards_honors 表） */
export interface Award {
  id: string
  user_id: string | null
  anonymous_id: string | null
  title: string
  issuing_org: string | null
  award_year: number | null
  award_month: number | null
  description: string | null
  sort_order: number
  created_at: string
}

/** 论文/专利/出版物实体（对应 publications 表） */
export interface Publication {
  id: string
  user_id: string | null
  anonymous_id: string | null
  title: string
  pub_type: PubType
  authors: string[] | null
  author_position: number | null
  publication_venue: string | null
  publisher: string | null
  pub_year: number | null
  pub_month: number | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  patent_number: string | null
  arxiv_id: string | null
  isbn: string | null
  url: string | null
  citation_count: number | null
  impact_factor: number | null
  status: PubStatus
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}
