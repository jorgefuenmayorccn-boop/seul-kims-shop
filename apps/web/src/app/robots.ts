import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cuenta', '/checkout', '/b2b/dashboard', '/api'],
    },
    sitemap: 'https://seoulshop.cl/sitemap.xml',
  }
}
