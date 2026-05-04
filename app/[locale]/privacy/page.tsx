import { useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { NavBar } from '@/components/layout/NavBar'
import { Link } from '@/lib/i18n/navigation'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'privacy' })
  return { title: t('title') }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PrivacyContent />
}

function PrivacyContent() {
  const t = useTranslations('privacy')

  const sections = [
    { title: t('s1_title'), body: t('s1_body') },
    { title: t('s2_title'), body: t('s2_body') },
    { title: t('s3_title'), body: t('s3_body') },
    { title: t('s4_title'), body: t('s4_body') },
    { title: t('s5_title'), body: t('s5_body') },
    { title: t('s6_title'), body: t('s6_body') },
    { title: t('s7_title'), body: t('s7_body') },
    { title: t('s8_title'), body: t('s8_body') },
  ]

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1b1b24] font-[Inter,sans-serif] antialiased">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 md:px-12 pt-32 pb-24">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-3">
            {t('title')}
          </h1>
          <p className="text-sm text-[#777587]">{t('last_updated')}</p>
        </div>

        <p className="text-[#464555] leading-relaxed mb-10">{t('intro')}</p>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-headline font-bold text-[#1b1b24] mb-2">{s.title}</h2>
              <p className="text-[#464555] leading-relaxed text-sm">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-[#c7c4d8]/30">
          <Link
            href="/"
            className="text-[#3525cd] font-bold text-sm flex items-center gap-2 hover:underline"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            {t('back')}
          </Link>
        </div>
      </main>
    </div>
  )
}
