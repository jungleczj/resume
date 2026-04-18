import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'

/**
 * Root page — detects locale and redirects to /zh-CN or /en-US.
 * Replaces the deleted middleware (which crashed on Vercel Edge Runtime).
 * This runs in Node.js, so no __dirname issues.
 */
export default async function RootPage() {
  const cookieStore = await cookies()

  // 1. Returning user — saved locale cookie
  const saved = cookieStore.get('NEXT_LOCALE')?.value
  if (saved === 'en-US') redirect('/en-US')
  if (saved === 'zh-CN') redirect('/zh-CN')

  // 2. First-time visitor — Accept-Language
  const headerStore = await headers()
  const al = headerStore.get('accept-language') ?? ''
  if (/\ben/i.test(al)) redirect('/en-US')

  // 3. Default
  redirect('/zh-CN')
}
