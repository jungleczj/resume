import { create } from 'zustand'
import type { WorkExperience, Achievement, ResumeLang, Profile } from '@/lib/types/domain'

interface WorkspaceState {
  // Layout
  splitRatio: number
  setSplitRatio: (ratio: number) => void

  // Resume settings
  resumeLang: ResumeLang
  setResumeLang: (lang: ResumeLang) => void
  showPhoto: boolean
  togglePhoto: () => void
  photoPath: string | null
  setPhotoPath: (path: string | null) => void

  // JD
  jdText: string
  setJdText: (text: string) => void
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void

  // Achievements
  experiences: WorkExperience[]
  setExperiences: (exps: WorkExperience[]) => void
  activeTab: 'library' | 'drafts'
  setActiveTab: (tab: 'library' | 'drafts') => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Resume editor JSON (TipTap)
  editorJson: object
  setEditorJson: (json: object) => void

  // Identity
  anonymousId: string
  setAnonymousId: (id: string) => void
  userId: string | null
  setUserId: (id: string | null) => void
  profile: Profile | null
  setProfile: (p: Profile | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  splitRatio: 0.4,
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),

  resumeLang: 'zh',
  setResumeLang: (lang) => set({ resumeLang: lang }),
  showPhoto: false,
  togglePhoto: () => set((s) => ({ showPhoto: !s.showPhoto })),
  photoPath: null,
  setPhotoPath: (path) => set({ photoPath: path }),

  jdText: '',
  setJdText: (text) => set({ jdText: text }),
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  experiences: [],
  setExperiences: (exps) => set({ experiences: exps }),
  activeTab: 'library',
  setActiveTab: (tab) => set({ activeTab: tab }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  editorJson: {},
  setEditorJson: (json) => set({ editorJson: json }),

  anonymousId: '',
  setAnonymousId: (id) => set({ anonymousId: id }),
  userId: null,
  setUserId: (id) => set({ userId: id }),
  profile: null,
  setProfile: (p) => set({ profile: p })
}))
