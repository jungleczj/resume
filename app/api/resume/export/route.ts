import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { shouldShowPaywall } from '@/lib/services/paywall'
import { trackEvent } from '@/lib/analytics'
import { generatePDF } from '@/lib/utils/pdf-generator'
import { generateDOCX } from '@/lib/utils/docx-generator'
import type { ResumePersonalInfo, ResumeEducation, ResumeSkillGroup, WorkExperience, ResumeLang, Certification, SpokenLanguage, Award, Publication } from '@/lib/types/domain'

interface ResumeDataPayload {
  personalInfo: ResumePersonalInfo | null
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  certifications?: Certification[]
  spokenLanguages?: SpokenLanguage[]
  awards?: Award[]
  publications?: Publication[]
  experiences: WorkExperience[]
  showPhoto: boolean
  photoPath: string | null
  lang: ResumeLang
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      format: string
      anonymous_id?: string
      user_id?: string | null
      version_id?: string
      resumeData?: ResumeDataPayload
    }

    const { format, anonymous_id, user_id, version_id, resumeData } = body

    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    const supabase = await createClient()

    // Paywall check: only for authenticated EN users (cn_free always passes)
    const { show: needsPayment } = await shouldShowPaywall(user_id ?? null, 'export')
    if (needsPayment) {
      return NextResponse.json({ requires_payment: true }, { status: 402 })
    }

    // ── Use client-provided resume data (preferred — reflects in-session edits) ──
    if (resumeData) {
      const pi = resumeData.personalInfo
      const lang: 'zh' | 'en' = resumeData.lang === 'en' ? 'en' : 'zh'

      const blob =
        format === 'pdf'
          ? await generatePDF({
              name: pi?.name ?? '',
              contact: {
                email: pi?.email,
                phone: pi?.phone,
                location: pi?.location,
                linkedin: pi?.linkedin,
                website: pi?.website,
              },
              summary: pi?.summary,
              experiences: resumeData.experiences,
              education: resumeData.education,
              skills: resumeData.skills,
              certifications: resumeData.certifications,
              spokenLanguages: resumeData.spokenLanguages,
              awards: resumeData.awards,
              publications: resumeData.publications,
              photoUrl: resumeData.showPhoto ? resumeData.photoPath : null,
              showPhoto: resumeData.showPhoto,
              lang
            })
          : await generateDOCX({
              name: pi?.name ?? '',
              contact: {
                email: pi?.email,
                phone: pi?.phone,
                location: pi?.location,
                linkedin: pi?.linkedin,
                website: pi?.website,
              },
              summary: pi?.summary,
              experiences: resumeData.experiences,
              education: resumeData.education,
              skills: resumeData.skills,
              certifications: resumeData.certifications,
              spokenLanguages: resumeData.spokenLanguages,
              awards: resumeData.awards,
              publications: resumeData.publications,
              photoUrl: resumeData.showPhoto ? resumeData.photoPath : null,
              showPhoto: resumeData.showPhoto,
              lang
            })

      await trackEvent('export_completed', {
        anonymous_id: anonymous_id ?? '',
        format,
        lang,
        has_photo: resumeData.showPhoto
      })

      const contentType =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      return new NextResponse(blob, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="resume.${format}"`
        }
      })
    }

    // ── Fallback: read all data from DB (used by payment success page) ────────
    let name = ''
    let email = ''
    let phone = ''
    let location = ''
    let linkedin = ''
    let website = ''
    let summary = ''
    let lang: 'zh' | 'en' = 'zh'
    let showPhoto = lang === 'zh'
    let photoPath: string | null = null

    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user_id)
        .single()
      if (profile) {
        lang = (profile as Record<string, unknown>).resume_lang_preference === 'en' ? 'en' : 'zh'
        phone = (profile as Record<string, unknown>).phone as string ?? ''
        showPhoto = (profile as Record<string, unknown>).photo_show_toggle as boolean ?? lang === 'zh'
        photoPath = (profile as Record<string, unknown>).photo_path as string | null ?? null
      }

      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        email = authData.user.email ?? ''
        name = (authData.user.user_metadata?.full_name as string | undefined)
          ?? (authData.user.user_metadata?.name as string | undefined)
          ?? ''
      }
    }

    // Override show_photo from version if specified
    if (version_id) {
      const { data: ver } = await supabase
        .from('resume_versions')
        .select('show_photo, photo_path')
        .eq('id', version_id)
        .single()
      if (ver) {
        showPhoto = ver.show_photo
        if (ver.photo_path) photoPath = ver.photo_path
      }
    }

    // Load parsed_data for personal info + education + skills
    const uploadQuery = supabase
      .from('resume_uploads')
      .select('parsed_data')
      .eq('parse_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    const { data: uploadRows } = user_id
      ? await uploadQuery.eq('user_id', user_id)
      : await uploadQuery.eq('anonymous_id', anonymous_id ?? '')

    const parsedData = uploadRows?.[0]?.parsed_data as Record<string, unknown> | null | undefined
    const parsedInfo = parsedData?.personal_info as Record<string, string | null> | null | undefined
    const parsedEducation = (parsedData?.education as ResumeEducation[] | null | undefined) ?? []
    const parsedSkills = (parsedData?.skills as ResumeSkillGroup[] | null | undefined) ?? []
    const parsedCertifications = (parsedData?.certifications as Certification[] | null | undefined) ?? []
    const parsedSpokenLanguages = (parsedData?.spoken_languages as SpokenLanguage[] | null | undefined) ?? []
    const parsedAwards = (parsedData?.awards as Award[] | null | undefined) ?? []
    const parsedPublications = (parsedData?.publications as Publication[] | null | undefined) ?? []

    if (parsedInfo) {
      if (!name && parsedInfo.name) name = parsedInfo.name
      if (!email && parsedInfo.email) email = parsedInfo.email
      if (!phone && parsedInfo.phone) phone = parsedInfo.phone
      if (parsedInfo.location) location = parsedInfo.location
      if (parsedInfo.linkedin) linkedin = parsedInfo.linkedin
      if (parsedInfo.website) website = parsedInfo.website
      if (parsedInfo.summary) summary = parsedInfo.summary
    }

    // Load experiences + confirmed achievements
    const expQuery = supabase
      .from('work_experiences')
      .select('*, achievements(*)')
      .order('sort_order', { ascending: true })

    const { data: experiences, error: expError } = user_id
      ? await expQuery.eq('user_id', user_id)
      : await expQuery.eq('anonymous_id', anonymous_id ?? '')

    if (expError) throw new Error(expError.message)

    const expWithConfirmed = (experiences ?? []).map((exp) => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter(
        (a: Record<string, unknown>) => a.status === 'confirmed'
      )
    })) as WorkExperience[]

    const blob =
      format === 'pdf'
        ? await generatePDF({
            name,
            contact: { email, phone, location, linkedin, website },
            summary,
            experiences: expWithConfirmed,
            education: parsedEducation,
            skills: parsedSkills,
            certifications: parsedCertifications,
            spokenLanguages: parsedSpokenLanguages,
            awards: parsedAwards,
            publications: parsedPublications,
            photoUrl: showPhoto ? photoPath : null,
            showPhoto,
            lang
          })
        : await generateDOCX({
            name,
            contact: { email, phone, location, linkedin, website },
            summary,
            experiences: expWithConfirmed,
            education: parsedEducation,
            skills: parsedSkills,
            certifications: parsedCertifications,
            spokenLanguages: parsedSpokenLanguages,
            awards: parsedAwards,
            publications: parsedPublications,
            photoUrl: showPhoto ? photoPath : null,
            showPhoto,
            lang
          })

    await trackEvent('export_completed', {
      anonymous_id: anonymous_id ?? '',
      format,
      lang,
      has_photo: showPhoto
    })

    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="resume.${format}"`
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
