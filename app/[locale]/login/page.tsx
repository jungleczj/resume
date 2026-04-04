'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'

export default function LoginPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    await trackEvent('login_google_clicked', { locale })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/${locale}/workspace` }
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    await trackEvent('login_email_clicked', { locale })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/${locale}/workspace` }
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen overflow-hidden">
      {/* LEFT: Form panel */}
      <section className="w-full lg:w-[45%] flex flex-col p-8 md:p-12 lg:p-16 xl:p-24 bg-surface-container-lowest relative z-10">
        {/* Logo */}
        <header className="mb-12 md:mb-20">
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary font-headline">
            CareerFlow
          </Link>
        </header>

        {/* Form */}
        <div className="max-w-md w-full mx-auto lg:mx-0 flex flex-col justify-center flex-grow">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4 leading-[1.1] font-headline">
              {locale === 'zh-CN' ? (
                <>解锁你的<br /><span className="text-primary-container">职业潜力</span></>
              ) : (
                <>Unlock Your <br /><span className="text-primary-container">Career Potential</span></>
              )}
            </h1>
            <p className="text-on-surface-variant leading-relaxed">
              {locale === 'zh-CN'
                ? '进入 AI 智能工作台，开启你的职业成长之旅。'
                : 'Access your AI-architected workspace and transform your professional trajectory today.'}
            </p>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface font-headline mb-2">
                {locale === 'zh-CN' ? '邮件已发送！' : 'Check your email!'}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {locale === 'zh-CN'
                  ? `已发送登录链接至 ${email}`
                  : `We sent a magic link to ${email}`}
              </p>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full bg-surface-container-highest text-on-surface font-semibold transition-all hover:bg-surface-container-high active:scale-95 border border-outline-variant/10 disabled:opacity-60"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-on-surface/20 border-t-on-surface rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {locale === 'zh-CN' ? '使用 Google 账号继续' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div className="relative my-8 flex items-center">
                <div className="flex-grow border-t border-outline-variant/20" />
                <span className="mx-4 text-xs font-bold tracking-widest text-on-surface-variant/60 uppercase">OR</span>
                <div className="flex-grow border-t border-outline-variant/20" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1" htmlFor="email">
                    {locale === 'zh-CN' ? '邮箱地址' : 'Email Address'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={locale === 'zh-CN' ? 'name@company.com' : 'name@company.com'}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-high border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-error">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-4 px-6 rounded-full text-on-primary font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {locale === 'zh-CN' ? '发送中...' : 'Sending...'}
                    </span>
                  ) : (
                    locale === 'zh-CN' ? '发送登录链接' : 'Continue with Email'
                  )}
                </button>
              </form>

              <p className="mt-8 text-xs text-on-surface-variant leading-relaxed text-center lg:text-left">
                {locale === 'zh-CN' ? '继续即代表你同意我们的' : 'By continuing, you acknowledge our '}
                <Link href="/privacy" className="underline font-medium hover:text-primary transition-colors">
                  {locale === 'zh-CN' ? '隐私政策' : 'Privacy Policy'}
                </Link>
                {locale === 'zh-CN' ? ' 和 ' : ' and '}
                <Link href="/terms" className="underline font-medium hover:text-primary transition-colors">
                  {locale === 'zh-CN' ? '服务条款' : 'Terms of Service'}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>

      {/* RIGHT: Visual showcase */}
      <section className="hidden lg:flex w-[55%] bg-surface-container-low relative items-center justify-center overflow-hidden">
        {/* Abstract background */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: '#4f46e5' + '1a' }} />
          <div className="absolute bottom-[-5%] left-[10%] w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: '#b6b4ff' + '33' }} />
        </div>

        {/* Dashboard preview */}
        <div className="relative w-[90%] max-w-2xl glass-panel rounded-3xl shadow-2xl border border-outline-variant/10 p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-widest">CareerFlow AI</p>
              <h3 className="text-xl font-bold text-on-surface font-headline mt-0.5">
                {locale === 'zh-CN' ? '职业成就仪表盘' : 'Career Dashboard'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: locale === 'zh-CN' ? '成就总数' : 'Total', value: '42', icon: 'emoji_events', color: 'text-primary' },
              { label: locale === 'zh-CN' ? '已确认' : 'Validated', value: '18', icon: 'verified', color: 'text-green-600' },
              { label: locale === 'zh-CN' ? 'ATS 匹配' : 'ATS Score', value: '94%', icon: 'auto_awesome', color: 'text-tertiary' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface-container-lowest rounded-2xl p-4 text-center">
                <span className={`material-symbols-outlined text-2xl ${stat.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                <p className="text-xl font-bold text-on-surface font-headline mt-1">{stat.value}</p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Achievement list preview */}
          <div className="space-y-2">
            {[
              { text: locale === 'zh-CN' ? '将用户留存率提升 24%，通过游戏化引导流程' : 'Increased user retention by 24% via gamified onboarding', tier: 1 },
              { text: locale === 'zh-CN' ? '主导微服务迁移，降低响应时间 140ms' : 'Led microservices migration, reduced response time by 140ms', tier: 2 },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-surface-container-lowest rounded-xl p-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.tier === 1 ? 'bg-achievement-tier1' : 'bg-achievement-tier2'}`} />
                <p className="text-xs text-on-surface leading-snug">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex -space-x-2">
              {['#4F46E5', '#16A34A', '#CA8A04'].map((color, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">
              {locale === 'zh-CN' ? '已有 12,000+ 职场人使用' : '12,000+ professionals trust CareerFlow'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
