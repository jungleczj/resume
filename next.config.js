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
    return [
      // 1. Returning user with saved locale cookie
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
      // 2. First-time visitor — Accept-Language contains "en"
      {
        source: '/',
        has: [{ type: 'header', key: 'accept-language', value: '.*en.*' }],
        destination: '/en-US',
        permanent: false,
      },
      // 3. Default fallback → zh-CN
      {
        source: '/',
        destination: '/zh-CN',
        permanent: false,
      },
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
