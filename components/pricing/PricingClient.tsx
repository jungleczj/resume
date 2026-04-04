'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { NavBar } from '@/components/layout/NavBar'

export default function PricingClient() {
  const [selectedPlan, setSelectedPlan] = useState<'export' | 'monthly' | 'yearly'>('yearly')
  const t = useTranslations('pricing')

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1b1b24] font-[Inter,sans-serif] antialiased">
      <NavBar />
      <main className="min-h-screen pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Left Side: Product Value */}
          <div className="lg:col-span-5 space-y-12 py-8">
            <div className="space-y-6">
              <h1 className="font-headline text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#1b1b24]">
                {t('title_before')}<span className="text-[#3525cd]">{t('title_highlight')}</span>
              </h1>
              <p className="text-lg text-[#464555] max-w-md leading-relaxed">
                {t('subtitle')}
              </p>
            </div>
            <div className="space-y-8">
              <div className="flex gap-5 group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#3525cd]/10 flex items-center justify-center text-[#3525cd] group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-[#1b1b24] mb-1">{t('vp1_title')}</h3>
                  <p className="text-[#464555]">{t('vp1_desc')}</p>
                </div>
              </div>
              <div className="flex gap-5 group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#a44100]/10 flex items-center justify-center text-[#7e3000] group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-[#1b1b24] mb-1">{t('vp2_title')}</h3>
                  <p className="text-[#464555]">{t('vp2_desc')}</p>
                </div>
              </div>
              <div className="flex gap-5 group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#58579b]/10 flex items-center justify-center text-[#58579b] group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>grid_view</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-[#1b1b24] mb-1">{t('vp3_title')}</h3>
                  <p className="text-[#464555]">{t('vp3_desc')}</p>
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#a44100]/10 border border-[#a44100]/20">
              <span className="material-symbols-outlined text-[#7e3000]" style={{fontVariationSettings: "'FILL' 1"}}>lightbulb</span>
              <p className="text-sm font-medium text-[#7b2f00]">{t('pro_tip')}</p>
            </div>
          </div>

          {/* Right Side: Pricing Section */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="grid md:grid-cols-3 gap-4 items-stretch">
              {/* Per Export */}
              <div
                onClick={() => setSelectedPlan('export')}
                className={`bg-white rounded-xl p-8 flex flex-col shadow-sm hover:shadow-xl transition-all duration-300 border cursor-pointer min-h-[621px] ${selectedPlan === 'export' ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]' : 'border-[#c7c4d8]/10'}`}
              >
                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#464555]">{t('per_export_name')}</span>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-headline font-extrabold text-[#1b1b24]">{t('per_export_price')}</span>
                    <span className="text-[#464555] text-sm ml-1">{t('per_export_period')}</span>
                  </div>
                  <p className="text-[10px] text-[#464555] mt-1">{t('per_export_desc')}</p>
                </div>
                <ul className="space-y-4 flex-grow">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#3525cd] text-lg">check_circle</span>
                    <span>{t('per_export_f1')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#3525cd] text-lg">check_circle</span>
                    <span>{t('per_export_f2')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#777587] text-lg">cancel</span>
                    <span className="text-[#777587]">{t('per_export_no')}</span>
                  </li>
                </ul>
              </div>

              {/* Monthly */}
              <div
                onClick={() => setSelectedPlan('monthly')}
                className={`bg-white rounded-xl p-8 flex flex-col shadow-sm hover:shadow-xl transition-all duration-300 border cursor-pointer min-h-[621px] ${selectedPlan === 'monthly' ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]' : 'border-[#c7c4d8]/10'}`}
              >
                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#464555]">{t('monthly_name')}</span>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-headline font-extrabold text-[#1b1b24]">{t('monthly_price')}</span>
                    <span className="text-[#464555] text-sm ml-1">{t('monthly_period')}</span>
                  </div>
                  <p className="text-[10px] text-[#464555] mt-1">{t('monthly_desc')}</p>
                </div>
                <ul className="space-y-4 flex-grow">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#3525cd] text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                    <span>{t('monthly_f1')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#3525cd] text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                    <span>{t('monthly_f2')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#3525cd] text-lg">check_circle</span>
                    <span>{t('monthly_f3')}</span>
                  </li>
                </ul>
              </div>

              {/* Yearly - Best Value */}
              <div
                onClick={() => setSelectedPlan('yearly')}
                className="relative bg-white rounded-xl p-8 flex flex-col shadow-2xl ring-2 ring-[#4f46e5] border-none overflow-hidden z-10 cursor-pointer min-h-[621px] transition-all duration-300 hover:shadow-3xl"
              >
                <div className="absolute top-0 right-0 bg-[#4f46e5] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg font-headline uppercase tracking-wider">{t('yearly_badge')}</div>
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">{t('yearly_name')}</span>
                    <span className="bg-indigo-100 text-[#4f46e5] text-[10px] font-bold px-2 py-0.5 rounded-full">{t('yearly_save')}</span>
                  </div>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-headline font-extrabold text-[#1b1b24]">{t('yearly_price')}</span>
                    <span className="text-[#464555] text-sm ml-1">{t('yearly_period')}</span>
                  </div>
                  <p className="text-[10px] text-[#464555] mt-1">{t('yearly_desc')}</p>
                </div>
                <ul className="space-y-4 flex-grow">
                  <li className="flex items-start gap-2 text-sm font-semibold text-indigo-900">
                    <span className="material-symbols-outlined text-[#4f46e5] text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                    <span>{t('yearly_f1')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm font-semibold text-indigo-900">
                    <span className="material-symbols-outlined text-[#4f46e5] text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                    <span>{t('yearly_f2')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#4f46e5] text-lg">check_circle</span>
                    <span>{t('yearly_f3')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-[#4f46e5] text-lg">check_circle</span>
                    <span>{t('yearly_f4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-4">
              <button className="w-full py-5 rounded-full bg-[#4f46e5] text-white font-headline text-lg font-extrabold shadow-xl hover:opacity-95 transition-all hover:scale-[1.01] active:scale-95">
                {t('cta')}
              </button>
            </div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="mt-20 pt-12 border-t border-[#c7c4d8]/20 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2 text-[#464555]">
              <span className="material-symbols-outlined text-green-600" style={{fontVariationSettings: "'FILL' 1"}}>shield_with_heart</span>
              <span className="font-semibold">{t('trust')}</span>
            </div>
            <p className="text-xs text-[#464555]/70">{t('trust_sub')}</p>
          </div>
          <div className="flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
            <div className="h-8 flex items-center bg-white px-3 rounded shadow-sm">
              <img alt="Stripe logo" className="h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrJsTNcB8oRvD6YZN7ITjYWDV3zW9O4g1nxrvccGVjc9sVR_9sG-1Ye61a28O_mhtQm09ll8bxxwE_LyLBmwb03zijpVjFsfycrU_GSAnn1nYXxAb5MxA-DQuJqV8Fzu_XsVJ-fcARDO95QpLd1Q3ku9yVE3QFT08CYUT_1zJCRYdzBB-8VbP_5-MEn44hk5EPsXFTmqnbvalKIjkW2MeFjyG9d43i3rJa9ETmvZCD5j_3GHL_JNfejn_jTJQ6PdVAhKGQPV6FUugQ" />
            </div>
            <div className="h-8 flex items-center bg-white px-3 rounded shadow-sm">
              <img alt="PayPal logo" className="h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFjLAndY4Ux0H46OPUw-hyZDJyPVy4q7BoKdkKYCdN4DJJ-p6zS843ss3N9YWNneN9AV0RASUtLGQAvyqHedPhSh-ND6823Ep6-xW2HiKtyfWtsRNlLa4oCvZUv5qpMATzoqFohBN3o6kn-xhR_q6QwvUUZ749vGM47Vp4LFa_PAcni2dkUXBMMUQL87L8P6TYZXUpZBXQvQYrwvnw_vwz-LlSyHzJTxm2i3FEjSiDFsj62zttd3uGelvjjx4pqKKjPFuY4o0ntV6I" />
            </div>
            <div className="h-8 flex items-center bg-white px-3 rounded shadow-sm">
              <img alt="Mastercard logo" className="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6q-JzfxPafPKk2r9ZgSlU6NyGukwE4zk0pzGsz1ic-7RXlF6mxeZoMuHw1VsCYrpK4gQVBnQYD94kTQ3kGOr5WMmk2AbC-sMgWOMhgDVQ8fHyoBVi6_T31khZHY4F4xglgE2T-Lsd8HLs-JTwkrRdu198Kj2S8dgY9wb7TWA7oNXnhdGMb7sxCD0sQV9GsmlDmVd4WS_NZvKqFZbVWqfVem5as3SLEES8dyyMVYzdIAZtNsfCAZqgoeTw-ySXx2EgSdqx--o-OzU7" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-slate-50">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-12 w-full max-w-7xl mx-auto">
          <div className="mb-6 md:mb-0">
            <div className="text-lg font-bold text-slate-900 font-headline mb-2">CareerFlow AI</div>
            <p className="text-slate-500 text-sm tracking-wide uppercase">{t('footer_tagline')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="text-slate-500 hover:text-indigo-600 transition-colors text-sm tracking-wide uppercase opacity-80 hover:opacity-100" href="#">{t('footer_privacy')}</a>
            <a className="text-slate-500 hover:text-indigo-600 transition-colors text-sm tracking-wide uppercase opacity-80 hover:opacity-100" href="#">{t('footer_terms')}</a>
            <a className="text-slate-500 hover:text-indigo-600 transition-colors text-sm tracking-wide uppercase opacity-80 hover:opacity-100" href="#">{t('footer_support')}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
