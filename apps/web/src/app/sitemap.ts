import type { MetadataRoute } from 'next'

export const revalidate = 3600

const BASE_URL = 'https://seoulkims.cl'

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  { url: `${BASE_URL}/productos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/b2b`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
    const res = await fetch(`${API_URL}/api/products?status=active&limit=500`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return STATIC_PAGES

    const data = (await res.json()) as { products: { slug: string; updatedAt?: string }[] }

    const productPages: MetadataRoute.Sitemap = data.products.map(p => ({
      url: `${BASE_URL}/producto/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    return [...STATIC_PAGES, ...productPages]
  } catch {
    return STATIC_PAGES
  }
}
