// Fetch con cache tags — solo para Server Components y Route Handlers
// NO importar desde Client Components

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const TIMEOUT_MS = 8_000

export const CACHE_TAGS = {
  products:    'products',
  product:     (slug: string) => `product:${slug}`,
  categories:  'categories',
  heroBanners: 'hero-banners',
  faq:         'faq',
  promotions:  'promotions',
} as const

export async function apiServerFetch<T>(
  path: string,
  options?: { tags?: string[]; revalidate?: number | false }
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      next: {
        tags:       options?.tags ?? [],
        revalidate: options?.revalidate ?? 60,
      },
    })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}
