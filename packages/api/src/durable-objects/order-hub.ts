// OrderHub — Durable Object singleton para broadcasting de eventos en tiempo real
// Un DO por tienda: idFromName('seoul-kims')
// Soporta SSE (Server-Sent Events) hacia el POS

export class OrderHub {
  private subscribers = new Map<string, WritableStreamDefaultWriter<Uint8Array>>()
  private encoder      = new TextEncoder()

  constructor(
    private readonly state: DurableObjectState,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // POST /publish — emitir evento a todos los suscriptores
    if (url.pathname === '/publish' && request.method === 'POST') {
      return this.handlePublish(request)
    }

    // GET /subscribe — abrir stream SSE para un cliente
    if (url.pathname === '/subscribe' && request.method === 'GET') {
      return this.handleSubscribe(url)
    }

    // GET /health — número de conexiones activas
    if (url.pathname === '/health') {
      return Response.json({ subscribers: this.subscribers.size })
    }

    return new Response('Not found', { status: 404 })
  }

  private async handlePublish(request: Request): Promise<Response> {
    let body: unknown
    try { body = await request.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const ssePayload = `data: ${JSON.stringify(body)}\n\n`
    const encoded    = this.encoder.encode(ssePayload)

    const dead: string[] = []

    for (const [clientId, writer] of this.subscribers) {
      try {
        await writer.write(encoded)
      } catch {
        dead.push(clientId)
        try { writer.releaseLock() } catch { /* ignore */ }
      }
    }

    for (const id of dead) this.subscribers.delete(id)

    return Response.json({ ok: true, delivered: this.subscribers.size, dropped: dead.length })
  }

  private handleSubscribe(url: URL): Response {
    const clientId = url.searchParams.get('clientId') ?? crypto.randomUUID()

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer                 = writable.getWriter()

    this.subscribers.set(clientId, writer)

    // Keepalive cada 25s para evitar que proxies corten la conexión
    const keepaliveInterval = setInterval(async () => {
      try {
        await writer.write(this.encoder.encode(': keepalive\n\n'))
      } catch {
        clearInterval(keepaliveInterval)
        this.subscribers.delete(clientId)
      }
    }, 25_000)

    // Comentario inicial de conexión confirmada
    writer.write(this.encoder.encode(`: connected clientId=${clientId}\n\n`)).catch(() => {})

    // Cleanup on writer close (keepalive catch handles it)
    writer.closed.catch(() => {
      clearInterval(keepaliveInterval)
      this.subscribers.delete(clientId)
    })

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Client-Id':   clientId,
      },
    })
  }
}
