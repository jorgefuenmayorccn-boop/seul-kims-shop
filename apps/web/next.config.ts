import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@seul/ui', '@seul/tokens'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pub-*.r2.dev' },          // Cloudflare R2
      { protocol: 'https', hostname: '*.seoulkims.cl' },
    ],
  },
  async headers() {
    return [
      {
        // Headers de seguridad
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default config
