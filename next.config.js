// next.config.js  (CommonJS — __dirname available natively)
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: undefined,
  // Exclude Node.js-only packages from webpack bundling.
  // pdf-parse v1.1.1 references __dirname at module evaluation time (for test fixtures),
  // which is undefined in the Edge runtime. Marking these external forces Next.js to
  // require() them natively in the Node.js API route runtime instead of bundling them.
  serverExternalPackages: ['pdf-parse', 'mammoth', 'pdf-lib', '@pdf-lib/fontkit'],
  experimental: {},
  webpack: (config, { isServer, nextRuntime }) => {
    // Provide next-intl config alias for ALL builds EXCEPT Edge Runtime.
    // The middleware runs in Edge Runtime and does not use next-intl at all;
    // setting this alias there caused a bundling chain on Vercel:
    //   next-intl/config → lib/i18n/request.ts → next-intl/server → __dirname (crash)
    if (nextRuntime !== 'edge') {
      config.resolve.alias['next-intl/config'] = path.resolve(
        __dirname,
        'lib/i18n/request.ts'
      )
    }

    if (!isServer) {
      // pdfjs-dist uses canvas in Node.js (server) context only; ignore in browser
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
