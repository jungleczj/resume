import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
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
