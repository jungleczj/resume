import { routing } from '@/lib/i18n/routing'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as 'zh-CN' | 'en-US')) {
    notFound()
  }

  // Without middleware, next-intl can't detect locale automatically.
  // setRequestLocale injects it into the request context so getMessages()
  // and useTranslations() in all server components load the correct language.
  setRequestLocale(locale)

  const messages = await getMessages()

  return (
    <>
      {/* Set <html lang> from the [locale] segment at parse time */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang="${locale}"`
        }}
      />
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </>
  )
}
