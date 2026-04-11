import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: undefined,
  // Exclude Node.js-only packages from webpack bundling.
  // pdf-parse v1.1.1 references __dirname at module evaluation time (for test fixtures),
  // which is undefined in the Edge runtime. Marking these external forces Next.js to
  // require() them natively in the Node.js API route runtime instead of bundling them.
  serverExternalPackages: ['pdf-parse', 'mammoth', 'pdf-lib', '@pdf-lib/fontkit'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  webpack: (config, { isServer }) => {
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

export default withNextIntl(nextConfig)
