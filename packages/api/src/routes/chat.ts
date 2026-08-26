import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { products } from '@seul/db/schema'
import { eq } from 'drizzle-orm'

// Bindings deben incluir ANTHROPIC_API_KEY (wrangler secret)
type ChatBindings = Bindings & { ANTHROPIC_API_KEY: string }

const router = new Hono<{ Bindings: ChatBindings }>()

const SYSTEM_PROMPT = `Eres el asistente de Seoul Kims (@seulshopcl), tienda especializada en productos coreanos ubicada en Viña del Mar, Chile.

Ayudas a clientes con:
- Información sobre productos coreanos (ramen, salsas, snacks, K-Beauty, etc.)
- Preguntas sobre delivery (Rappi en Viña/Reñaca/Concón, retiro en Metro Merval gratis)
- Precios y disponibilidad (dirígelos a la tienda en línea para precios exactos)
- Preparación de platos coreanos básicos (tteok-bokki, kimchi, bulgogi)
- Subsidio BAES para estudiantes JUNAEB (validan TNE en caja)
- Cuentas mayoristas B2B (dirige a /b2b/registro)
- Política de devoluciones (10 días hábiles, Ley del Consumidor)

Reglas:
- Responde siempre en español, de forma cálida y concisa (máx 3 párrafos)
- Para pedidos, devoluciones complejas o reclamos, indica que contacten al +56936451991 vía WhatsApp
- No inventes precios ni stock — di que verifiquen en la tienda
- Si el tema no es sobre Seoul Kims o comida coreana, redirige gentilmente
- Usa algún término coreano ocasionalmente (annyeong, gamsahamnida, masin-sseo-yo) pero sin exagerar`

const messageSchema = z.object({
  messages: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).min(1).max(20),
})

router.post('/', zValidator('json', messageSchema), async (c) => {
  const body = c.req.valid('json')
  const env  = c.env as ChatBindings

  if (!env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'Asistente no disponible' }, 503)
  }

  // Llama directamente a la API de Anthropic (fetch nativo — compatible con Workers)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     SYSTEM_PROMPT,
      messages:   body.messages,
    }),
  })

  if (!res.ok) {
    console.error('[CHAT_ERROR]', await res.text())
    return c.json({ error: 'Error del asistente. Intenta de nuevo.' }, 502)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>
  }

  const reply = data.content.find(b => b.type === 'text')?.text ?? ''

  return c.json({ reply })
})

export { router as chatRouter }
