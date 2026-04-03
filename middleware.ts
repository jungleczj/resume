import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Run i18n middleware first
  const response = intlMiddleware(request)

  // Supabase session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (response) {
              response.cookies.set(name, value, options)
            }
          })
        }
      }
    }
  )

  await supabase.auth.getUser()

  return response ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)']
}
