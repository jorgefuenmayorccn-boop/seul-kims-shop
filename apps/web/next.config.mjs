/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@seul/ui', '@seul/tokens', '@seul/icons'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
      { protocol: 'https', hostname: '*.seoulkims.cl' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Dev: datos seed usan picsum
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      // Dev: API local sirviendo imágenes desde R2 simulado
      { protocol: 'http', hostname: 'localhost', port: '8787' },
    ],
  },
  async headers() {
    return [
      {
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
