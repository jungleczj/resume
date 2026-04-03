// Database types
export type PaymentMarket = 'cn_free' | 'en_paid'
export type AchievementStatus = 'draft' | 'confirmed' | 'ignored'
export type AchievementTier = 1 | 2 | 3

export interface Profile {
  id: string
  payment_market: PaymentMarket
  signup_geo_country?: string
  resume_lang_preference: 'zh' | 'zh-en' | 'en'
  photo_path?: string
  photo_show_toggle: boolean
  created_at: string
  updated_at: string
}

export interface ResumeUpload {
  id: string
  user_id?: string
  anonymous_id?: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  photo_extracted?: string
  created_at: string
}

export interface Achievement {
  id: string
  user_id?: string
  anonymous_id?: string
  experience_id?: string
  text: string
  status: AchievementStatus
  tier: AchievementTier
  has_placeholders: boolean
  ai_score?: number
  source: string
  embedding?: number[]
  created_at: string
  updated_at: string
}

export interface ResumeVersion {
  id: string
  user_id?: string
  anonymous_id?: string
  upload_id?: string
  editor_json: object
  photo_path?: string
  show_photo: boolean
  template_key: string
  snapshot_label?: string
  snapshot_jd?: string
  created_at: string
  updated_at: string
}
