import { Hono } from 'hono'
import { eq, and, or, isNull, lte, gte, asc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { heroBanners } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/hero-banners — público
router.get('/', async (c) => {
  const db  = getDb(c.env)
  const now = new Date()

  const banners = await db.select().from(heroBanners)
    .where(and(
      eq(heroBanners.active, true),
      or(isNull(heroBanners.startsAt), lte(heroBanners.startsAt, now)),
      or(isNull(heroBanners.endsAt),   gte(heroBanners.endsAt, now)),
    ))
    .orderBy(asc(heroBanners.sortOrder))

  return c.json({ ok: true, banners })
})

export { router as heroBannersRouter }
