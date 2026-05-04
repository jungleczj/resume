// next.config.js  (CommonJS — __dirname available natively)
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: undefined,
  serverExternalPackages: ['pdf-parse', 'mammoth', 'pdf-lib', '@pdf-lib/fontkit'],
  experimental: {},

  // ── Locale redirect (replaces middleware entirely) ────────────────────────
  // These run in Node.js at the routing layer — no Edge Runtime, no __dirname issue.
  async redirects() {
    // Pages that live under /[locale]/ — bare paths (e.g. /library) must redirect
    // to the locale-prefixed version. Without middleware, bare paths return 404.
    const localedPages = [
      '/library', '/workspace', '/settings', '/login',
      '/pricing', '/upload', '/privacy', '/terms', '/refund',
    ]

    const pageRedirects = localedPages.flatMap((page) => [
      // Returning user with saved locale cookie
      {
        source: page,
        has: [{ type: 'cookie', key: 'NEXT_LOCALE', value: 'en-US' }],
        destination: `/en-US${page}`,
        permanent: false,
      },
      {
        source: page,
        has: [{ type: 'cookie', key: 'NEXT_LOCALE', value: 'zh-CN' }],
        destination: `/zh-CN${page}`,
        permanent: false,
      },
      // Accept-Language "en" → English
      {
        source: page,
        has: [{ type: 'header', key: 'accept-language', value: '.*en.*' }],
        destination: `/en-US${page}`,
        permanent: false,
      },
      // Default fallback → zh-CN
      {
        source: page,
        destination: `/zh-CN${page}`,
        permanent: false,
      },
    ])

    return [
      // ── Root path ──────────────────────────────────────────────────────────
      {
        source: '/',
        has: [{ type: 'cookie', key: 'NEXT_LOCALE', value: 'en-US' }],
        destination: '/en-US',
        permanent: false,
      },
      {
        source: '/',
        has: [{ type: 'cookie', key: 'NEXT_LOCALE', value: 'zh-CN' }],
        destination: '/zh-CN',
        permanent: false,
      },
      {
        source: '/',
        has: [{ type: 'header', key: 'accept-language', value: '.*en.*' }],
        destination: '/en-US',
        permanent: false,
      },
      {
        source: '/',
        destination: '/zh-CN',
        permanent: false,
      },
      // ── Locale-prefixed pages ───────────────────────────────────────────────
      ...pageRedirects,
    ]
  },

  webpack: (config, { isServer, nextRuntime }) => {
    // Provide next-intl config alias for server builds.
    // next-intl/server needs this to locate lib/i18n/request.ts.
    if (nextRuntime !== 'edge') {
      config.resolve.alias['next-intl/config'] = path.resolve(
        __dirname,
        'lib/i18n/request.ts'
      )
    }

    if (!isServer) {
      config.resolve.alias.canvas = false
      config.resolve.alias.encoding = false
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**'
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com'
      }
    ]
  }
}

module.exports = nextConfig
