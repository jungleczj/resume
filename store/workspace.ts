import { create } from 'zustand'
import type { WorkExperience, Achievement, ResumeLang, Profile, ResumePersonalInfo, ResumeEducation, ResumeSkillGroup, Certification, SpokenLanguage, Award, Publication } from '@/lib/types/domain'

interface WorkspaceState {
  splitRatio: number
  setSplitRatio: (ratio: number) => void
  verticalSplitRatio: number
  setVerticalSplitRatio: (ratio: number) => void

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

  // Supplemental Fortune 500 resume sections
  resumeCertifications: Certification[]
  resumeLanguages: SpokenLanguage[]
  resumeAwards: Award[]
  resumePublications: Publication[]
  setResumeSections: (certs: Certification[], langs: SpokenLanguage[], awards: Award[], pubs: Publication[]) => void

  // Inline-edit actions (called from ResumePreview contentEditable fields)
  updatePersonalInfoField: (field: keyof ResumePersonalInfo, value: string) => void
  updateExperienceField: (expId: string, field: 'company' | 'job_title' | 'original_tenure', value: string) => void
  updateAchievementText: (expId: string, achId: string, text: string) => void
  updateAchievementProject: (expId: string, achId: string, projectName: string | null, projectMemberRole: string | null) => void
  updateEducation: (education: ResumeEducation[]) => void
  updateSkills: (skills: ResumeSkillGroup[]) => void

  anonymousId: string
  setAnonymousId: (id: string) => void
  userId: string | null
  setUserId: (id: string | null) => void
  profile: Profile | null
  setProfile: (p: Profile | null) => void

  // Original uploaded file for preview
  uploadFilePath: string | null
  uploadFileType: string | null
  setUploadFile: (filePath: string | null, fileType: string | null) => void

  // Achievement status actions
  confirmAchievement: (achId: string) => Promise<void>
  ignoreAchievement: (achId: string) => Promise<void>

  // Update achievement text from panel inline edit (persists to DB)
  updateAchievementInPanel: (achId: string, text: string) => Promise<void>

  // Version save
  saveVersion: (snapshotLabel?: string) => Promise<void>

  // Save button feedback
  isSaving: boolean
  setSaving: (v: boolean) => void

  // Bidirectional achievement highlight (resume ↔ panel)
  activeAchievementId: string | null
  setActiveAchievementId: (id: string | null) => void

  // Drag-drop replace state (keyed by ach.id)
  pendingDropTarget: string | null
  setPendingDropTarget: (id: string | null) => void

  // Drag-drop insert state (keyed by exp.id)
  pendingInsertTarget: string | null
  setPendingInsertTarget: (id: string | null) => void

  // Replace achievement in resume preview (drag-drop from panel onto resume li)
  replaceAchievementInResume: (expId: string, targetAchId: string, newAchievement: Achievement) => void

  // Insert achievement at end of experience block (drag-drop into insert zone)
  insertAchievementInResume: (expId: string, newAchievement: Achievement) => void

  // Translated achievement texts (achId → translatedText), populated on lang switch
  translatedTexts: Record<string, string>
  setTranslatedTexts: (texts: Record<string, string>) => void
  clearTranslatedTexts: () => void

  // Original zh data saved when translating profile (restored on switch back to zh)
  originalPersonalInfo: ResumePersonalInfo | null
  originalEducation: ResumeEducation[] | null
  originalSkills: ResumeSkillGroup[] | null
  // Apply translated profile (saves originals, replaces store values with translations)
  applyTranslatedProfile: (
    info: ResumePersonalInfo | null,
    education: ResumeEducation[],
    skills: ResumeSkillGroup[]
  ) => void

  // Restore a version snapshot: update confirmed/draft status to match editor_json
  restoreVersion: (editorJson: object, resumeLang?: string, showPhoto?: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  splitRatio: 0.4,
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
  verticalSplitRatio: 0.4,
  setVerticalSplitRatio: (ratio) => set({ verticalSplitRatio: ratio }),

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

  resumeCertifications: [],
  resumeLanguages: [],
  resumeAwards: [],
  resumePublications: [],
  setResumeSections: (certs, langs, awards, pubs) =>
    set({ resumeCertifications: certs, resumeLanguages: langs, resumeAwards: awards, resumePublications: pubs }),

  updatePersonalInfoField: (field, value) =>
    set((s) => ({
      resumePersonalInfo: s.resumePersonalInfo
        ? { ...s.resumePersonalInfo, [field]: value }
        : null
    })),
  updateExperienceField: (expId, field, value) =>
    set((s) => ({
      experiences: s.experiences.map((exp) =>
        exp.id === expId ? { ...exp, [field]: value } : exp
      )
    })),
  updateAchievementText: (expId, achId, text) =>
    set((s) => ({
      experiences: s.experiences.map((exp) =>
        exp.id === expId
          ? {
              ...exp,
              achievements: (exp.achievements ?? []).map((a) =>
                a.id === achId ? { ...a, text } : a
              )
            }
          : exp
      )
    })),
  updateAchievementProject: (expId, achId, projectName, projectMemberRole) =>
    set((s) => ({
      experiences: s.experiences.map((exp) =>
        exp.id === expId
          ? {
              ...exp,
              achievements: (exp.achievements ?? []).map((a) =>
                a.id === achId
                  ? { ...a, project_name: projectName, project_member_role: projectMemberRole }
                  : a
              )
            }
          : exp
      )
    })),
  updateEducation: (education) => set({ resumeEducation: education }),
  updateSkills: (skills) => set({ resumeSkills: skills }),

  anonymousId: '',
  setAnonymousId: (id) => set({ anonymousId: id }),
  userId: null,
  setUserId: (id) => set({ userId: id }),
  profile: null,
  setProfile: (p) => set({ profile: p }),

  uploadFilePath: null,
  uploadFileType: null,
  setUploadFile: (filePath, fileType) => set({ uploadFilePath: filePath, uploadFileType: fileType }),

  // ── Achievement status actions ────────────────────────────────────────────
  confirmAchievement: async (achId: string) => {
    set((s) => ({
      experiences: s.experiences.map((exp) => ({
        ...exp,
        achievements: (exp.achievements ?? []).map((a) =>
          a.id === achId ? { ...a, status: 'confirmed' as const } : a
        ),
      })),
    }))
    try {
      await fetch(`/api/achievements/${achId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
    } catch {
      // Silently ignore network errors — optimistic update stays
    }
  },

  ignoreAchievement: async (achId: string) => {
    set((s) => ({
      experiences: s.experiences.map((exp) => ({
        ...exp,
        achievements: (exp.achievements ?? []).map((a) =>
          a.id === achId ? { ...a, status: 'ignored' as const } : a
        ),
      })),
    }))
    try {
      await fetch(`/api/achievements/${achId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ignored' }),
      })
    } catch {
      // Silently ignore network errors — optimistic update stays
    }
  },

  // ── Panel inline edit ─────────────────────────────────────────────────────
  updateAchievementInPanel: async (achId: string, text: string) => {
    // Optimistic local update across all experiences
    set((s) => ({
      experiences: s.experiences.map((exp) => ({
        ...exp,
        achievements: (exp.achievements ?? []).map((a) =>
          a.id === achId ? { ...a, text } : a
        ),
      })),
    }))
    try {
      await fetch(`/api/achievements/${achId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    } catch {
      // Silently ignore — local update already applied
    }
  },

  // ── Version save ─────────────────────────────────────────────────────────
  saveVersion: async (snapshotLabel?: string) => {
    const s = get()

    // Build editor_json from current experience + confirmed achievements so that
    // restoreVersion() can reconstruct exactly which achievements were in this snapshot.
    const confirmedExps = s.experiences.filter(exp =>
      (exp.achievements ?? []).some(a => a.status === 'confirmed')
    )
    const builtEditorJson = confirmedExps.length > 0
      ? {
          type: 'doc',
          content: confirmedExps.map(exp => ({
            type: 'experience',
            attrs: {
              experience_id: exp.id,
              company: exp.company,
              job_title: exp.job_title,
              original_tenure: exp.original_tenure ?? null,
              start_year: exp.start_date ? new Date(exp.start_date).getFullYear() : null,
              end_year: exp.end_date ? new Date(exp.end_date).getFullYear() : null,
              is_current: exp.is_current,
            },
            content: (exp.achievements ?? [])
              .filter(a => a.status === 'confirmed')
              .map(a => ({
                type: 'achievement',
                attrs: { id: a.id, tier: a.tier },
                content: [{ type: 'text', text: a.text }],
              })),
          })),
          meta: {
            lang: s.resumeLang,
            generated_at: new Date().toISOString(),
          },
        }
      : s.editorJson  // fallback: no confirmed achievements, save whatever was last generated

    try {
      await fetch('/api/resume/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editor_json: builtEditorJson,
          anonymous_id: s.anonymousId || null,
          user_id: s.userId ?? null,
          snapshot_label: snapshotLabel ?? null,
          snapshot_jd: s.jdText || null,
          resume_lang: s.resumeLang,
          show_photo: s.showPhoto,
        }),
      })
    } catch {
      // Silently ignore — version save is best-effort
    }
  },

  // ── Save button feedback ──────────────────────────────────────────────────
  isSaving: false,
  setSaving: (v) => set({ isSaving: v }),

  // ── Bidirectional highlight ───────────────────────────────────────────────
  activeAchievementId: null,
  setActiveAchievementId: (id) => set({ activeAchievementId: id }),

  // ── Drag-drop replace state ───────────────────────────────────────────────
  pendingDropTarget: null,
  setPendingDropTarget: (id) => set({ pendingDropTarget: id }),

  // ── Drag-drop insert state ────────────────────────────────────────────────
  pendingInsertTarget: null,
  setPendingInsertTarget: (id) => set({ pendingInsertTarget: id }),

  // ── Replace achievement in resume (drag from panel → drop on resume li) ──
  replaceAchievementInResume: (expId: string, targetAchId: string, newAchievement: Achievement) => {
    set((s) => ({
      experiences: s.experiences.map((exp) => {
        if (exp.id !== expId) return exp
        return {
          ...exp,
          achievements: (exp.achievements ?? []).map((a) =>
            a.id === targetAchId
              ? { ...newAchievement, status: 'confirmed' as const }
              : a
          ),
        }
      }),
    }))
  },

  // ── Translated texts ──────────────────────────────────────────────────────
  translatedTexts: {},
  setTranslatedTexts: (texts) => set({ translatedTexts: texts }),
  clearTranslatedTexts: () => {
    const s = get()
    if (s.originalPersonalInfo !== null) {
      set({
        translatedTexts: {},
        resumePersonalInfo: s.originalPersonalInfo,
        resumeEducation: s.originalEducation ?? s.resumeEducation,
        resumeSkills: s.originalSkills ?? s.resumeSkills,
        originalPersonalInfo: null,
        originalEducation: null,
        originalSkills: null,
      })
    } else {
      set({ translatedTexts: {} })
    }
  },

  // ── Profile translation (originals saved for restore) ─────────────────────
  originalPersonalInfo: null,
  originalEducation: null,
  originalSkills: null,
  applyTranslatedProfile: (info, education, skills) => {
    const s = get()
    // Save originals only on first apply (not already saved)
    const snap = s.originalPersonalInfo === null ? {
      originalPersonalInfo: s.resumePersonalInfo,
      originalEducation: s.resumeEducation,
      originalSkills: s.resumeSkills,
    } : {}
    set({
      ...snap,
      ...(info ? { resumePersonalInfo: info } : {}),
      ...(education.length > 0 ? { resumeEducation: education } : {}),
      ...(skills.length > 0 ? { resumeSkills: skills } : {}),
    })
  },

  // ── Restore version snapshot ──────────────────────────────────────────────
  restoreVersion: (editorJson: object, resumeLang?: string, showPhoto?: boolean) => {
    const json = editorJson as {
      content?: Array<{
        type: string
        attrs?: { experience_id?: string }
        content?: Array<{
          type: string
          attrs?: { id?: string }
          content?: Array<{ type: string; text?: string }>
        }>
      }>
    }

    if (json?.content) {
      // Collect achievement IDs that were confirmed in this version snapshot
      const includedAchIds = new Set<string>()
      for (const expNode of json.content) {
        for (const achNode of expNode.content ?? []) {
          if (achNode.type === 'achievement' && achNode.attrs?.id) {
            includedAchIds.add(achNode.attrs.id)
          }
        }
      }

      // Update experiences: restore confirm/draft status to match the version
      set((s) => ({
        experiences: s.experiences.map((exp) => ({
          ...exp,
          achievements: (exp.achievements ?? []).map((a) => ({
            ...a,
            status: includedAchIds.has(a.id) ? ('confirmed' as const) : ('draft' as const),
          })),
        })),
        editorJson,
        ...(resumeLang ? { resumeLang: resumeLang as ResumeLang } : {}),
        ...(showPhoto !== undefined ? { showPhoto } : {}),
      }))
    } else {
      set({ editorJson })
    }
  },

  // ── Insert achievement at end of experience block ─────────────────────────
  insertAchievementInResume: (expId: string, newAchievement: Achievement) => {
    set((s) => ({
      experiences: s.experiences.map((exp) => {
        if (exp.id !== expId) return exp
        // Avoid duplicates — if already in this exp, just confirm it
        const alreadyHere = (exp.achievements ?? []).some((a) => a.id === newAchievement.id)
        if (alreadyHere) {
          return {
            ...exp,
            achievements: (exp.achievements ?? []).map((a) =>
              a.id === newAchievement.id ? { ...a, status: 'confirmed' as const } : a
            ),
          }
        }
        return {
          ...exp,
          achievements: [
            ...(exp.achievements ?? []),
            { ...newAchievement, status: 'confirmed' as const },
          ],
        }
      }),
    }))
    // Confirm status in DB as well
    fetch(`/api/achievements/${newAchievement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    }).catch(() => {})
  },
}))
