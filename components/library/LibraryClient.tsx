'use client'

import { NavBar } from '@/components/layout/NavBar'

export default function LibraryClient() {
  return (
    <div className="bg-[#fcf8ff] text-[#1b1b24] min-h-screen">
      <NavBar />
      <div className="flex pt-20">
        {/* Side Navigation Bar */}
        <aside className="fixed left-0 top-20 flex flex-col pt-8 px-4 h-screen w-64 border-r border-slate-100 bg-slate-50">
          <div className="mb-8 px-4">
            <h3 className="font-headline text-sm font-medium uppercase tracking-widest text-slate-400">Library</h3>
            <p className="text-xs text-slate-500 mt-1">Achievement Categories</p>
          </div>
          <nav className="space-y-1">
            <a className="flex items-center gap-3 px-4 py-3 bg-white text-indigo-600 rounded-xl shadow-sm font-headline text-sm font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">apps</span>
              All
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-indigo-50/50 rounded-lg font-headline text-sm font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">edit_note</span>
              Drafts
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-indigo-50/50 rounded-lg font-headline text-sm font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">verified</span>
              Validated
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-indigo-50/50 rounded-lg font-headline text-sm font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">archive</span>
              Archived
            </a>
          </nav>
          <div className="mt-auto mb-24 px-4">
            <h4 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Imported Sources</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-[#f5f2ff] rounded-lg border border-[#c7c4d8]/5">
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-slate-700 text-lg">description</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate text-[#1b1b24]">Notion Workspace</p>
                  <p className="text-[9px] text-[#4F46E5]">Connected</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-[#f5f2ff] rounded-lg border border-[#c7c4d8]/5">
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-blue-500 text-lg">cloud_queue</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate text-[#1b1b24]">Google Drive</p>
                  <p className="text-[9px] text-[#4F46E5]">Connected</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="ml-64 flex-1 p-12 min-h-screen">
          <header className="mb-8">
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-[#1b1b24] mb-2">Achievement Library</h1>
            <p className="text-lg text-[#464555] font-medium opacity-80">Your professional narrative, parsed and perfected.</p>
          </header>

          {/* Stats Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Achievements', value: '42', icon: 'emoji_events', color: 'text-indigo-600' },
              { label: 'Validated Metrics', value: '18', icon: 'trending_up', color: 'text-green-600' },
              { label: 'Pending Review', value: '12', icon: 'pending_actions', color: 'text-amber-600' },
              { label: 'Connected Sources', value: '5', icon: 'link', color: 'text-indigo-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-[#c7c4d8]/10 flex flex-col justify-between">
                <p className="text-sm font-bold text-[#777587] uppercase tracking-wider mb-2">{stat.label}</p>
                <div className="flex items-end justify-between">
                  <span className={`text-3xl font-extrabold font-headline ${stat.color}`}>{stat.value}</span>
                  <span className={`material-symbols-outlined ${stat.color}/20 text-4xl`} style={{opacity: 0.2}}>{stat.icon}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Search Bar */}
          <div className="mb-8 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#777587] group-focus-within:text-[#4F46E5] transition-colors">search</span>
            </div>
            <input
              className="block w-full pl-12 pr-4 py-4 bg-white border border-[#c7c4d8]/20 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[#1b1b24] font-medium shadow-sm placeholder:text-[#777587]/60"
              placeholder="Search your career wins, metrics, or sources..."
              type="text"
            />
          </div>

          {/* Achievement Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#c7c4d8]/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f2ff]/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">Achievement Description</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587] text-right">Impact Metric</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c7c4d8]/10">
                {[
                  {
                    desc: 'Led the architectural redesign of the core payment gateway, migrating from monolithic to microservices architecture.',
                    tags: ['Engineering', 'Architecture'],
                    status: 'Validated',
                    metric: '40% Latency Reduction',
                  },
                  {
                    desc: "Spearheaded the 'Project Aurora' cross-functional initiative to streamline customer onboarding processes.",
                    tags: ['Leadership'],
                    status: 'Draft',
                    metric: '2.5x Faster Onboarding',
                  },
                  {
                    desc: 'Developed a proprietary AI model for sentiment analysis which improved marketing conversion rates through personalization.',
                    tags: ['Data Science', 'AI/ML'],
                    status: 'Validated',
                    metric: '18% Revenue Growth',
                  },
                  {
                    desc: 'Managed a team of 12 designers across 3 time zones, delivering a unified design system for the entire product ecosystem.',
                    tags: ['Management'],
                    status: 'Validated',
                    metric: 'Zero Legacy Debt',
                  },
                ].map((row, i) => (
                  <tr key={i} className="group hover:bg-indigo-50/20 transition-colors duration-150">
                    <td className="px-6 py-6 max-w-md">
                      <p className="text-sm font-semibold text-[#1b1b24] leading-relaxed">{row.desc}</p>
                      <div className="flex gap-2 mt-2">
                        {row.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit ${row.status === 'Validated' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Validated' ? 'bg-green-500' : 'bg-amber-400'}`}></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{row.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <span className="text-sm font-extrabold text-indigo-600 font-headline tracking-tight">{row.metric}</span>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button className="w-8 h-8 flex items-center justify-center hover:bg-indigo-50 text-indigo-600 transition-colors rounded-full" title="Validate">
                          <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors rounded-full" title="Edit">
                          <span className="material-symbols-outlined text-[20px]">edit_square</span>
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded-full" title="Archive">
                          <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Stats */}
          <footer className="mt-8 flex justify-between items-center text-[#464555]">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {['JS', 'MK', 'AL'].map(initials => (
                  <div key={initials} className="w-8 h-8 rounded-full border-2 border-[#fcf8ff] bg-slate-200 flex items-center justify-center text-[10px] font-bold">{initials}</div>
                ))}
              </div>
              <p className="text-xs font-medium">Shared with 3 contributors</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium opacity-60">
              <span className="material-symbols-outlined text-sm">sync</span>
              Last synced with Notion 4 mins ago
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
