// Core domain types for CareerFlow

export type PaymentMarket = 'cn_free' | 'en_paid'
export type ResumeLang = 'zh' | 'en'
export type AchievementStatus = 'draft' | 'confirmed' | 'ignored'
export type AchievementTier = 1 | 2 | 3
export type AchievementSource = 'upload' | 'notion' | 'manual'
export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type SyncType = 'manual' | 'webhook' | 'scheduled'
export type PaymentProvider = 'creem' | 'stripe'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Profile {
  id: string
  payment_market: PaymentMarket
  signup_geo_country: string | null
  resume_lang_preference: ResumeLang
  photo_path: string | null
  photo_show_toggle: boolean
  notion_access_token: string | null
  notion_workspace_id: string | null
  notion_connected_at: string | null
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
  start_year: number | null
  start_month: number | null
  end_year: number | null
  end_month: number | null
  original_date_text: string | null
  is_current: boolean
  sort_order: number
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
  | 'jd_parse'
  | 'achievement_extract'
  | 'achievement_match'

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
export interface BeautifyOutput {
  experiences: BeautifyExperience[]
}

export interface BeautifyExperience {
  company: string
  job_title: string
  start_year: number | null
  start_month: number | null
  end_year: number | null
  end_month: number | null
  original_date_text: string | null
  achievements: BeautifyAchievement[]
}

export interface BeautifyAchievement {
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
