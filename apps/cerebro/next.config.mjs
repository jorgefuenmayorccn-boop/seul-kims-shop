/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@seul/ui', '@seul/tokens'],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options',        value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy',        value: 'no-referrer' },
        // No indexar por buscadores
        { key: 'X-Robots-Tag',           value: 'noindex, nofollow' },
      ],
    }]
  },
}

export default config
