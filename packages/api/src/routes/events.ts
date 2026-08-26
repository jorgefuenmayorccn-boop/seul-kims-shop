import { Hono } from 'hono'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// Obtiene el stub singleton del OrderHub DO
function getOrderHub(env: Bindings) {
  const id = env.ORDER_HUB.idFromName('seoul-kims')
  return env.ORDER_HUB.get(id)
}

// GET /api/events/pos — stream SSE para el POS tablet
// El POS se suscribe aquí y recibe eventos en tiempo real sin polling
router.get('/pos', async (c) => {
  const clientId = c.req.query('clientId') ?? crypto.randomUUID()
  const hub      = getOrderHub(c.env)

  // Pipe del stream SSE desde el DO al cliente directamente
  const res = await hub.fetch(
    new Request(`http://do/subscribe?clientId=${encodeURIComponent(clientId)}`),
  )

  // Pasar headers SSE al cliente — CORS ya está cubierto por el middleware global
  const origin = c.req.header('Origin')
  return new Response(res.body, {
    headers: {
      'Content-Type':                     'text/event-stream',
      'Cache-Control':                    'no-cache',
      'Connection':                       'keep-alive',
      'Access-Control-Allow-Origin':      origin ?? 'http://localhost:3001',
      'Access-Control-Allow-Credentials': 'true',
      'X-Client-Id':                      clientId,
    },
  })
})

// GET /api/events/delivery — stream SSE para repartidores (móvil)
router.get('/delivery', requireAuth(['delivery', 'owner', 'admin', 'staff']), async (c) => {
  const clientId = c.req.query('clientId') ?? crypto.randomUUID()
  const hub      = getOrderHub(c.env)

  const res = await hub.fetch(
    new Request(`http://do/subscribe?clientId=${encodeURIComponent(clientId)}`),
  )

  const origin = c.req.header('Origin')
  return new Response(res.body, {
    headers: {
      'Content-Type':                     'text/event-stream',
      'Cache-Control':                    'no-cache',
      'Connection':                       'keep-alive',
      'Access-Control-Allow-Origin':      origin ?? 'http://localhost:3002',
      'Access-Control-Allow-Credentials': 'true',
      'X-Client-Id':                      clientId,
    },
  })
})

// GET /api/events/health — número de suscriptores SSE activos
router.get('/health', async (c) => {
  try {
    const hub = getOrderHub(c.env)
    const res = await hub.fetch(new Request('http://do/health'))
    const data = await res.json() as { subscribers: number }
    return c.json({ ok: true, subscribers: data.subscribers })
  } catch {
    return c.json({ ok: false, subscribers: 0 })
  }
})

// Helper interno — publicar un evento desde otros routes (orders.ts)
export async function publishOrderEvent(
  env: Bindings,
  event: {
    type:    string
    channel: string
    payload: Record<string, unknown>
  },
): Promise<void> {
  try {
    const hub = getOrderHub(env)
    await hub.fetch(new Request('http://do/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...event, ts: Date.now() }),
    }))
  } catch { /* silencioso — el DO puede no estar listo en dev */ }
}

export { router as eventsRouter }
