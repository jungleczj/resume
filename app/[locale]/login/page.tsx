'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations('login')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    trackEvent('login_google_clicked', {})
    const supabase = createClient()
    const anonId = typeof window !== 'undefined' ? localStorage.getItem('cf_anonymous_id') : null
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (anonId) callbackUrl.searchParams.set('anonymous_id', anonId)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() }
    })
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setEmailError(null)
    trackEvent('login_email_submitted', {})
    const supabase = createClient()
    const anonId = typeof window !== 'undefined' ? localStorage.getItem('cf_anonymous_id') : null
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (anonId) callbackUrl.searchParams.set('anonymous_id', anonId)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() }
    })
    setLoading(false)
    if (error) {
      setEmailError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <main className="flex min-h-screen bg-[#fcf8ff] text-[#1b1b24]" style={{overflow: 'hidden'}}>
      {/* LEFT SIDE: Form Area */}
      <section className="w-full lg:w-[45%] flex flex-col p-8 md:p-12 lg:p-16 xl:p-24 bg-white relative z-10">
        <header className="mb-12 md:mb-24">
          <div className="text-2xl font-bold tracking-tighter text-[#3525cd] font-headline">
            CareerFlow
          </div>
        </header>
        <div className="max-w-md w-full mx-auto lg:mx-0 flex flex-col justify-center flex-grow">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1b1b24] mb-4 leading-[1.1] font-headline">
              {t('title_before')}<br/>
              <span className="text-[#4f46e5]">{t('title_highlight')}</span>
              {t('title_after')}
            </h1>
            <p className="text-[#464555] leading-relaxed">
              {t('subtitle')}
            </p>
          </div>
          {/* Google Auth */}
          <button
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full bg-[#e4e1ee] text-[#1b1b24] font-semibold transition-all hover:bg-[#eae6f4] active:scale-95 border border-[#c7c4d8]/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('google_btn')}
          </button>
          {/* Divider */}
          <div className="relative my-10 flex items-center">
            <div className="flex-grow border-t border-[#c7c4d8]/20"></div>
            <span className="mx-4 text-xs font-bold tracking-widest text-[#464555]/60 uppercase">{t('or')}</span>
            <div className="flex-grow border-t border-[#c7c4d8]/20"></div>
          </div>
          {/* Email Form / Sent Confirmation */}
          {sent ? (
            <div className="rounded-2xl bg-[#eae6f4] px-6 py-5 text-center">
              <div className="text-3xl mb-2">📬</div>
              <p className="font-bold text-[#1b1b24] mb-1">
                {t('sent_title')}
              </p>
              <p className="text-sm text-[#464555]">
                {t('sent_body', { email })}
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-xs text-[#3525cd] underline hover:opacity-70"
              >
                {t('sent_retry')}
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleEmailLogin}>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#464555] px-1" htmlFor="email">{t('email_label')}</label>
                <input
                  className="w-full px-6 py-4 rounded-xl bg-[#eae6f4] border-none focus:ring-2 focus:ring-[#3525cd]/40 focus:bg-white transition-all text-[#1b1b24] placeholder:text-[#464555]/50"
                  id="email"
                  type="email"
                  placeholder={t('email_placeholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {emailError && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{emailError}</p>
              )}
              <button
                className="w-full py-4 px-6 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] text-white font-bold shadow-lg shadow-[#3525cd]/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                type="submit"
                disabled={loading || !email.trim()}
              >
                {loading ? t('sending') : t('email_btn')}
              </button>
            </form>
          )}
          <footer className="mt-8 text-center lg:text-left">
            <p className="text-xs text-[#464555] leading-relaxed">
              {t('legal_prefix')}{' '}
              <a className="underline font-medium hover:text-[#3525cd] transition-colors" href="#">{t('privacy')}</a>{' '}
              {t('legal_and')}{' '}
              <a className="underline font-medium hover:text-[#3525cd] transition-colors" href="#">{t('terms')}</a>.
            </p>
          </footer>
        </div>
      </section>

      {/* RIGHT SIDE: Visual Showcase */}
      <section className="hidden lg:flex w-[55%] bg-[#f5f2ff] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#3525cd]/10 blur-[120px]"></div>
          <div className="absolute bottom-[-5%] left-[10%] w-[400px] h-[400px] rounded-full bg-[#b6b4ff]/20 blur-[100px]"></div>
        </div>
        <div className="relative w-[90%] max-w-4xl h-[80%] glass-panel rounded-3xl shadow-2xl border border-[#c7c4d8]/10 p-10 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#4f46e5] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
              </div>
              <div>
                <div className="text-sm font-bold text-[#1b1b24]">Workspace Dashboard</div>
                <div className="text-[10px] uppercase tracking-tighter text-[#464555] font-bold">Live Precision Analytics</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#eae6f4] border border-[#c7c4d8]/20"></div>
              <div className="w-20 h-2 bg-[#eae6f4] rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-[#4f46e5]"></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-12 grid-rows-6 gap-6 flex-grow">
            <div className="col-span-7 row-span-4 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4 border border-[#c7c4d8]/5">
              <div className="flex items-center justify-between border-b border-[#c7c4d8]/10 pb-4">
                <h3 className="font-bold text-[#1b1b24]">Key Achievements</h3>
                <span className="material-symbols-outlined text-[#3525cd] text-lg">verified</span>
              </div>
              <div className="space-y-4 overflow-hidden">
                <div className="flex items-start gap-4 p-3 rounded-xl bg-[#f5f2ff]/50 border border-[#c7c4d8]/5">
                  <span className="material-symbols-outlined text-[#4f46e5] mt-1">rocket_launch</span>
                  <div>
                    <p className="text-sm font-semibold text-[#1b1b24]">Senior Product Manager</p>
                    <p className="text-xs text-[#464555]">Optimized for Google, Meta, and Amazon pipelines</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#f5f2ff] transition-colors">
                  <span className="material-symbols-outlined text-[#58579b] mt-1">analytics</span>
                  <div>
                    <p className="text-sm font-semibold text-[#1b1b24]">Revenue Growth Metrics</p>
                    <p className="text-xs text-[#464555]">Quantified impact: +24% YoY growth architected</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#f5f2ff] transition-colors opacity-60">
                  <span className="material-symbols-outlined text-[#777587] mt-1">hub</span>
                  <div>
                    <p className="text-sm font-semibold text-[#1b1b24]">Strategic Leadership</p>
                    <p className="text-xs text-[#464555]">Led cross-functional team of 15 designers</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-5 row-span-3 bg-gradient-to-br from-[#3525cd] to-[#4f46e5] rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">AI Status</p>
                <h3 className="text-xl font-bold mt-1">Optimization Complete</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" fill="transparent" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                    <circle cx="48" cy="48" fill="transparent" r="40" stroke="white" strokeDasharray="251.2" strokeDashoffset="30" strokeLinecap="round" strokeWidth="8"/>
                  </svg>
                  <span className="absolute text-2xl font-black">94%</span>
                </div>
                <p className="text-[10px] mt-4 opacity-90 font-medium">ATS Match Score</p>
              </div>
            </div>
            <div className="col-span-5 row-span-3 bg-white rounded-2xl p-6 shadow-sm border border-[#c7c4d8]/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#464555] text-base">link</span>
                <span className="text-xs font-bold text-[#464555] uppercase tracking-widest">Connected Sources</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#eae6f4]/40">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#3525cd]">description</span>
                    <span className="text-xs font-medium text-[#1b1b24]">Resume_v4.pdf</span>
                  </div>
                  <span className="material-symbols-outlined text-xs text-[#464555]">check_circle</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#464555]">work</span>
                    <span className="text-xs font-medium text-[#1b1b24]">LinkedIn Profile</span>
                  </div>
                  <span className="material-symbols-outlined text-xs text-[#464555]">sync</span>
                </div>
              </div>
            </div>
            <div className="col-span-7 row-span-2 flex flex-wrap gap-2 content-start pt-2">
              <div className="px-4 py-2 rounded-full bg-[#a44100]/10 text-[#7b2f00] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>lightbulb</span>
                Strengthen Action Verbs
              </div>
              <div className="px-4 py-2 rounded-full bg-[#4f46e5]/10 text-[#3525cd] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">target</span>
                Target: Google Cloud
              </div>
              <div className="px-4 py-2 rounded-full bg-[#413f82]/10 text-[#413f82] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                Market Demand: High
              </div>
            </div>
          </div>
          <div className="absolute -right-8 bottom-12 w-32 h-32 rounded-3xl overflow-hidden shadow-2xl rotate-6 border-4 border-white">
            <img className="w-full h-full object-cover" alt="Professional" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDo18aBZKI27PHRJetjd6HAPLBedyJb4L95cNzSvEPTd4oQOoryQ6XxMkFxnk6WCOmnLIai2ZaY91RQnasvpDcoEOWNQaqi0tbVgXDU4BvNWb726F1Yi9I82NT73z9PPlAUD5hVPILeS641rLJ22IxcZNznjKJ5RfrxNC27osyqanQn9AraJs2GUHLxaraIB7FdaYnSmh1Rq853yH-AqNRb-p5_FfQeTQ6aztH3Dtuhxy3F5eqDqeFYQSwZ_-hNoZCoV6kKmLYtMiX6" />
          </div>
        </div>
        <div className="absolute bottom-10 right-10 flex gap-4">
          <div className="flex -space-x-4">
            {[
              'https://lh3.googleusercontent.com/aida-public/AB6AXuCyG8IEyLbbDYUBoTPHkjBVoq3_pTmUYlYWJcWrxtuWI9RE6tupgJHbx05IYM23IpOlXFG3Ew5yFJMhI05iNc0U99r5zzwBj6ZwRoouDuyTsp2-E2psR8lWlz4rKvFc-NJadRomVfEYKLvuU7wNy9askpZmbU5uSbwsXA8NkrlJfm89ZoPZVEXSNnUrDPDS1CwywmcC69NVeISnbKHDIS2CAnSBx5s9D9pMJSjz538chJb4OysugfnRwD-E23BKDRcb4n6phMCQBZ0f',
              'https://lh3.googleusercontent.com/aida-public/AB6AXuDYLD7vhlOh-gUJG_UaF7Fspfyw8L9XFWYC14tZozpdzqo71sdr-8abLPdGgfSeUGSOqGDSlNiUt6rJwyTXqYsQSU8MORuFQpJkfSfsAg-peUhAtVtoOKxM01xd4iujNI7YE-4VLnNDWLlX7dm8PWqoCtqVbULnvxi0VjQezih6Qr4_sH-CFaUINzYuD4cB9SLN16r09moIu5bZYeC3Ua_vdXRbOlVKxJZUyLq78Yhq_mbQoURH49VhGLcbdWc7TSLcBh-FhPRwqiJd',
              'https://lh3.googleusercontent.com/aida-public/AB6AXuA-d7LTEQQZaZUJeGeLLFEYnwaelCRItSDU6UkUknap6MyFrmHREMl3ikBF8G5KtlMQWx8YTNHarTv-WvOVn4R4j8WZWaavIt9faxTSy_0drY9RQMUIaBsbM4klHNFupQH574n4GR09Ksprk9QZSG_bTeMuKC3XWK2I2nqNMapa6BVph1LsAm7gZ465cXuNccSjNZLdnkCOyJGOAe2G7C1BHPW2-WMDpnXM9sh-vyaTQQ8YHm8iSXGnpSjoDBiwCqoXsADegX2LSpv8'
            ].map((src, i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-[#f5f2ff] overflow-hidden">
                <img className="w-full h-full object-cover" alt="Professional" src={src} />
              </div>
            ))}
          </div>
          <div className="text-[#464555] text-[10px] leading-tight font-medium self-center">
            {t('social_proof')}
          </div>
        </div>
      </section>
    </main>
  )
}
