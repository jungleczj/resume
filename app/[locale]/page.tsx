'use client'

import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { NavBar } from '@/components/layout/NavBar'

export default function LandingPage() {
  const router = useRouter()
  const t = useTranslations('landing')

  const handleUploadClick = () => {
    router.push('/upload')
  }

  const testimonials = [
    {
      name: t('testimonials.t1_name'),
      role: t('testimonials.t1_role'),
      quote: t('testimonials.t1_quote'),
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDf8mN1tInkM8IrGI6D94rfV67I1PET_44C1zy2kIBmlaIGFn7z1XiFjWJXmTKbmyZubnbcXV1ngUpOKl2paRS1BmoiC-tmAevKiKQm2tmSnhNr9hSbOj37RRNh0VQz9FFyhoHXsPicZ-drJTi501dow47p56RCH1MoQ6-H536LEY0hMRpVbP51zcEWUnZ0dRnu4OTKaJgZf2ejOPQiz7PSi962rFsyQDIus-Ja6K1qht-S9sG72cNDVEEUK4oTqcAu_GZF-N0eXX8p'
    },
    {
      name: t('testimonials.t2_name'),
      role: t('testimonials.t2_role'),
      quote: t('testimonials.t2_quote'),
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP6OtHcsx1J76RPIrncCoY2ANjZF0t2Ippd_qnakuHSIFmPcyF2SrYCpW9dZWDoQapiqazAPGvz4khhWXvtAqrg7qvikNKUHP-EHQkkd0kDv_QoRCpxQC_lCbb7OzJ_EK3baH9TtiX99jHGl_iQKTW5J4HQ1F5C-65T1HQEzX98fOvT3tiVqvhG5ogAXKTtPby21LHfd7KDES_JH6uy5HbenvP4ld2cw-Qo-fHFcs64iA36TxboW_T2omztJLlYhtVv3bsC7ioGPtX'
    },
    {
      name: t('testimonials.t3_name'),
      role: t('testimonials.t3_role'),
      quote: t('testimonials.t3_quote'),
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwYnavxkTaGv9nA47ZmwrbAU0f66ySiEgJlgHlTUqMyHOOXZh5stHbLagiTq0mtav61624Cq6XTh0FXKQFBD6hUEPp9yFPoItEnQn3titynJT8hyFhKXOwE1VLkXonTTUhUDd-r8NUsES9xzmpfyR0sXZmFWIwSBaGBufUpU0aVGDxUvLMOglATbfqUz2uDd0qkCDhyM48_EIAnYvt1PU1rzIzJkBrTHBD3igryhf1PUjbXvfZEziJJdbV3hBFNcm1auGcQybh-Olg'
    },
  ]

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1b1b24] font-[Inter,sans-serif] antialiased">
      <NavBar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 z-10">
                <span className="inline-block py-1 px-4 rounded-full bg-[#a44100]/10 text-[#7b2f00] text-[10px] font-bold tracking-widest uppercase mb-6">
                  {t('hero.badge')}
                </span>
                <h1 className="text-5xl md:text-7xl font-extrabold text-[#1b1b24] tracking-tighter leading-[1.1] mb-6 font-headline">
                  {t('hero.title_before')}
                  <span className="text-[#3525cd]">{t('hero.title_highlight')}</span>
                  {t('hero.title_after')}
                </h1>
                <p className="text-lg md:text-xl text-[#464555] max-w-xl mb-10 leading-relaxed">
                  {t('hero.subtitle')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleUploadClick}
                    className="bg-gradient-to-br from-[#3525cd] to-[#4f46e5] text-white px-8 py-4 rounded-full font-headline font-bold text-base shadow-lg shadow-[#3525cd]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                  >
                    {t('hero.cta_upload')}
                  </button>
                  <button className="bg-[#eae6f4] text-[#1b1b24] px-8 py-4 rounded-full font-headline font-bold text-base hover:bg-[#e4e1ee] transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-xl">play_circle</span>
                    {t('hero.cta_demo')}
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5 relative">
                <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200/50">
                  <img
                    alt="AI Resume Analysis Interface"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5uYoJyusMkL67LWRgbvlEZNWCKx8DFyFZCLKYzvyaIa42TDbpob7VOHtXcVzwgqCxqYZKzRcyUJkCNELMOOFm5Ck2OrJl3nkQ7fkzC3kQzrPnWWk7Ehk05bF-T0E2uASbFHUdQiQ-HZKyLWezNTlBZ_8lbT50euYQydDy0YUuDdrPAA8jezcDEcBJGdPVWkg_NuDiUg0_z69AK0wPMISiL6ArMUwCl2cA-Bg22WgibROhtGaUvPOnNkZt6Tunv8CMRIuRCcDm-tmR"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 to-transparent pointer-events-none"></div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#464555] uppercase tracking-tighter">{t('hero.float_label')}</p>
                    <p className="text-sm font-headline font-bold text-emerald-600">{t('hero.float_score')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-[#3525cd]/5 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 -z-10 w-[300px] h-[300px] bg-[#7e3000]/5 blur-[100px] rounded-full"></div>
        </section>

        {/* Trust Section */}
        <section className="bg-[#f5f2ff] py-16">
          <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
            <p className="text-sm font-bold text-[#464555] tracking-[0.2em] uppercase mb-12">{t('trust.heading')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-headline font-black text-[#3525cd] tracking-tighter mb-2">{t('trust.stat1_num')}</span>
                <span className="text-[#464555] font-medium">{t('trust.stat1_label')}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-headline font-black text-[#3525cd] tracking-tighter mb-2">{t('trust.stat2_num')}</span>
                <span className="text-[#464555] font-medium">{t('trust.stat2_label')}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-headline font-black text-[#3525cd] tracking-tighter mb-2">{t('trust.stat3_num')}</span>
                <span className="text-[#464555] font-medium">{t('trust.stat3_label')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 md:py-32 bg-[#fcf8ff]">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">{t('features.heading')}</h2>
              <p className="text-[#464555] max-w-2xl mx-auto text-lg">{t('features.subheading')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_32px_rgba(27,27,36,0.04)] hover:shadow-[0_16px_48px_rgba(27,27,36,0.08)] transition-all group">
                <div className="w-14 h-14 rounded-xl bg-[#4f46e5]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#3525cd] text-3xl">description</span>
                </div>
                <h3 className="text-xl font-headline font-bold mb-4">{t('features.f1_title')}</h3>
                <p className="text-[#464555] leading-relaxed mb-6 text-sm">{t('features.f1_desc')}</p>
                <a className="text-[#3525cd] font-bold text-sm flex items-center gap-2 group-hover:underline" href="#">{t('features.learn_more')} <span className="material-symbols-outlined text-sm">arrow_forward</span></a>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_32px_rgba(27,27,36,0.04)] hover:shadow-[0_16px_48px_rgba(27,27,36,0.08)] transition-all group">
                <div className="w-14 h-14 rounded-xl bg-[#a44100]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#7e3000] text-3xl">link</span>
                </div>
                <h3 className="text-xl font-headline font-bold mb-4">{t('features.f2_title')}</h3>
                <p className="text-[#464555] leading-relaxed mb-6 text-sm">{t('features.f2_desc')}</p>
                <a className="text-[#3525cd] font-bold text-sm flex items-center gap-2 group-hover:underline" href="#">{t('features.learn_more')} <span className="material-symbols-outlined text-sm">arrow_forward</span></a>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_32px_rgba(27,27,36,0.04)] hover:shadow-[0_16px_48px_rgba(27,27,36,0.08)] transition-all group">
                <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-indigo-700 text-3xl">download</span>
                </div>
                <h3 className="text-xl font-headline font-bold mb-4">{t('features.f3_title')}</h3>
                <p className="text-[#464555] leading-relaxed mb-6 text-sm">{t('features.f3_desc')}</p>
                <a className="text-[#3525cd] font-bold text-sm flex items-center gap-2 group-hover:underline" href="#">{t('features.learn_more')} <span className="material-symbols-outlined text-sm">arrow_forward</span></a>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-[#f5f2ff] overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-headline font-extrabold mb-4">{t('how_it_works.heading')}</h2>
              <p className="text-[#464555]">{t('how_it_works.subheading')}</p>
            </div>
            <div className="relative">
              <div className="hidden lg:block absolute top-10 left-0 w-full h-0.5 bg-[#c7c4d8]/30"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 relative">
                {([
                  { num: '01', title: t('how_it_works.s1_title'), desc: t('how_it_works.s1_desc') },
                  { num: '02', title: t('how_it_works.s2_title'), desc: t('how_it_works.s2_desc') },
                  { num: '03', title: t('how_it_works.s3_title'), desc: t('how_it_works.s3_desc') },
                  { num: '04', title: t('how_it_works.s4_title'), desc: t('how_it_works.s4_desc') },
                ] as const).map(step => (
                  <div key={step.num} className="text-center">
                    <div className="w-20 h-20 rounded-full bg-white shadow-lg mx-auto flex items-center justify-center mb-6 relative z-10 border-4 border-[#f5f2ff]">
                      <span className="text-[#3525cd] font-headline font-black text-2xl">{step.num}</span>
                    </div>
                    <h4 className="font-headline font-bold mb-2">{step.title}</h4>
                    <p className="text-[#464555] text-sm px-4">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-20 text-center">
              <button
                onClick={handleUploadClick}
                className="bg-gradient-to-br from-[#3525cd] to-[#4f46e5] text-white px-10 py-4 rounded-full font-headline font-bold text-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
              >
                {t('how_it_works.cta')}
              </button>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-[#fcf8ff]">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">{t('testimonials.heading')}</h2>
              <p className="text-[#464555] text-lg">{t('testimonials.subheading')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map(item => (
                <div key={item.name} className="bg-[#f5f2ff] p-8 rounded-2xl border border-[#c7c4d8]/20 hover:border-[#4F46E5]/30 transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <img alt={item.name} className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" src={item.img} />
                    <div>
                      <h4 className="font-headline font-bold text-[#1b1b24]">{item.name}</h4>
                      <p className="text-xs text-[#464555] font-medium">{item.role}</p>
                    </div>
                  </div>
                  <p className="text-[#464555] leading-relaxed text-sm italic">{item.quote}</p>
                  <div className="mt-6 flex text-[#4F46E5]">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-6 md:px-12 bg-[#f5f2ff] text-sm">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto border-t border-indigo-100/20 pt-8">
          <div className="mb-8 md:mb-0">
            <span className="text-lg font-bold text-indigo-900 font-headline">CareerFlow AI</span>
            <p className="mt-2 text-slate-500">{t('footer.tagline')}</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex gap-8">
              <a className="text-slate-500 hover:text-indigo-700 underline underline-offset-4 transition-all" href="#">{t('footer.about')}</a>
              <a className="text-slate-500 hover:text-indigo-700 underline underline-offset-4 transition-all" href="#">{t('footer.privacy')}</a>
              <a className="text-slate-500 hover:text-indigo-700 underline underline-offset-4 transition-all" href="#">{t('footer.terms')}</a>
            </div>
            <p className="text-slate-500 mt-4 md:mt-0">{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
