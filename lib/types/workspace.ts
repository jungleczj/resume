export interface WorkspaceState {
  resumeLang: 'zh' | 'zh-en' | 'en'
  showPhoto: boolean
  splitRatio: number
  currentVersionId?: string
}

export interface JDMatchResult {
  matched_achievements: string[]
  relevance_scores: Record<string, number>
}
