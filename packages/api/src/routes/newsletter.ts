import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { newsletterSubscribers, emailQueue } from '@seul/db/schema'
import { generateToken } from '../lib/crypto'
import { sendEmail, templateNewsletterConfirm } from '../lib/send-email'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()
const WEB_URL = 'https://shop.seoulshop.cl' // env var from wrangler.toml

// POST /api/newsletter/subscribe
router.post('/subscribe', async (c) => {
  const { email, source } = await c.req.json<{ email?: string; source?: string }>()
  if (!email?.trim()) return c.json({ ok: false, error: 'Correo requerido' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ ok: false, error: 'Correo inválido' }, 400)

  const db = getDb(c.env)

  // Upsert — no duplicar
  const [existing] = await db.select({ id: newsletterSubscribers.id, confirmedAt: newsletterSubscribers.confirmedAt })
    .from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email.toLowerCase().trim()))

  if (existing?.confirmedAt) {
    return c.json({ ok: true, message: 'Ya estás suscrito/a.' })
  }

  const confirmToken = generateToken()

  if (existing) {
    await db.update(newsletterSubscribers)
      .set({ confirmToken, optOutAt: null })
      .where(eq(newsletterSubscribers.id, existing.id))
  } else {
    await db.insert(newsletterSubscribers).values({
      email:        email.toLowerCase().trim(),
      source:       source ?? 'unknown',
      confirmToken,
    })
  }

  const confirmUrl = `${WEB_URL}/api/newsletter/confirm/${confirmToken}`
  const emailResult = await sendEmail(c.env, {
    to:      email,
    subject: 'Confirma tu suscripción a SEUL SHOP',
    html:    templateNewsletterConfirm(confirmUrl),
  })

  await db.insert(emailQueue).values({
    email,
    type:       'newsletter',
    subject:    'Confirma tu suscripción a SEUL SHOP',
    status:     emailResult.ok ? 'sent' : 'failed',
    templateId: 'newsletter',
    templateData: { confirmUrl },
  })

  return c.json({ ok: true, message: 'Revisa tu correo para confirmar la suscripción.' })
})

// GET /api/newsletter/confirm/:token
router.get('/confirm/:token', async (c) => {
  const token = c.req.param('token')
  const db    = getDb(c.env)

  const [row] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmToken, token))

  if (!row) {
    return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Enlace inválido</h2><a href="/">Volver</a></body></html>`, 400)
  }

  await db.update(newsletterSubscribers)
    .set({ confirmedAt: new Date(), confirmToken: null })
    .where(eq(newsletterSubscribers.id, row.id))

  return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;color:#1A1A1A"><h1 style="color:#D7263D">서울킴스</h1><h2>Suscripción confirmada</h2><p>Gracias por unirte. Te mantendremos al tanto de nuestras novedades.</p><a href="/" style="color:#D7263D">Volver a la tienda</a></body></html>`)
})

// POST /api/newsletter/unsubscribe (token del email)
router.post('/unsubscribe', async (c) => {
  const { token } = await c.req.json<{ token?: string }>()
  if (!token) return c.json({ ok: false, error: 'Token requerido' }, 400)

  const db = getDb(c.env)
  const [row] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmToken, token))

  if (row) {
    await db.update(newsletterSubscribers)
      .set({ optOutAt: new Date() })
      .where(eq(newsletterSubscribers.id, row.id))
  }

  return c.json({ ok: true, message: 'Has cancelado tu suscripción.' })
})

export { router as newsletterRouter }
