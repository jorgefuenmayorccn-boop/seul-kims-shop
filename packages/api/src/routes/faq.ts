import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { faqEntries } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/faq — público, agrupado por categoría
router.get('/', async (c) => {
  const db      = getDb(c.env)
  const entries = await db.select().from(faqEntries)
    .where(eq(faqEntries.active, true))
    .orderBy(asc(faqEntries.category), asc(faqEntries.sortOrder))

  // Agrupar por categoría
  const grouped: Record<string, typeof entries> = {}
  for (const entry of entries) {
    const cat = entry.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(entry)
  }

  return c.json({ ok: true, entries, grouped })
})

export { router as faqRouter }
