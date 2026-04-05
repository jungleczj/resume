import { create } from 'zustand'
import type { WorkExperience, ResumeLang, Profile, ResumePersonalInfo, ResumeEducation, ResumeSkillGroup } from '@/lib/types/domain'

interface WorkspaceState {
  splitRatio: number
  setSplitRatio: (ratio: number) => void

  resumeLang: ResumeLang
  setResumeLang: (lang: ResumeLang) => void
  showPhoto: boolean
  togglePhoto: () => void
  setShowPhoto: (v: boolean) => void
  photoPath: string | null
  setPhotoPath: (path: string | null) => void

  jdText: string
  setJdText: (text: string) => void
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void

  experiences: WorkExperience[]
  setExperiences: (exps: WorkExperience[]) => void
  activeTab: 'library' | 'drafts'
  setActiveTab: (tab: 'library' | 'drafts') => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  editorJson: object
  setEditorJson: (json: object) => void

  // Parsed resume profile (personal info, education, skills)
  resumePersonalInfo: ResumePersonalInfo | null
  resumeEducation: ResumeEducation[]
  resumeSkills: ResumeSkillGroup[]
  setResumeProfile: (info: ResumePersonalInfo | null, education: ResumeEducation[], skills: ResumeSkillGroup[]) => void

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
  setShowPhoto: (v) => set({ showPhoto: v }),
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

  resumePersonalInfo: null,
  resumeEducation: [],
  resumeSkills: [],
  setResumeProfile: (info, education, skills) =>
    set({ resumePersonalInfo: info, resumeEducation: education, resumeSkills: skills }),

  anonymousId: '',
  setAnonymousId: (id) => set({ anonymousId: id }),
  userId: null,
  setUserId: (id) => set({ userId: id }),
  profile: null,
  setProfile: (p) => set({ profile: p })
}))
