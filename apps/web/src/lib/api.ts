// API pública — tienda B2C y B2B
// No contiene rutas administrativas (El Cerebro está en apps/cerebro)

const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const TIMEOUT_MS = 6_000

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

// Catálogo público
export async function getPublicProducts(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  try {
    return await apiFetch<{ products: Array<{ id: string; sku: string; name: string; nameKo?: string | null; slug: string; brand?: string | null; priceRetail: string | number; imageUrl?: string | null; categoryName?: string | null; stockTotal: number; isBaesEligible: boolean; coldChain: string }>; total: number }>(`/api/products${qs}`)
  } catch { return { products: [], total: 0 } }
}

// Upsert guest customer para checkout anónimo
export async function upsertGuestCustomer(data: {
  name: string; email: string; phone?: string
}): Promise<{ customerId: string; isNew: boolean }> {
  return apiFetch('/api/customers/guest', { method: 'POST', body: JSON.stringify(data) })
}

// Sesión del cliente (B2C)
export async function getCustomerSession(): Promise<{
  ok: boolean
  customer: { id: string; name: string; email: string } | null
}> {
  try {
    return await apiFetch('/api/customer/me', { credentials: 'include' } as RequestInit)
  } catch { return { ok: false, customer: null } }
}

// Sesión de empresa B2B — misma sesión de cliente (seul_customer_session),
// pero solo devuelve datos si esa cuenta tiene una empresa B2B asociada
// (GET /api/b2b/empresa/me, 401/403 si no). Usado por el checkout y el
// catálogo mayorista para saber si aplicar precio B2B y mostrar el flujo de
// pedido de empresa en vez del flujo B2C normal.
export interface B2BSession {
  id: string; razonSocial: string; rut: string; customerId: string
  creditLimitClp: number; creditUsedClp: number; walletBalanceClp: number
}
export async function getB2BSession(): Promise<B2BSession | null> {
  try {
    return await apiFetch<B2BSession>('/api/b2b/empresa/me', { credentials: 'include' } as RequestInit)
  } catch { return null }
}

// Pedido web
// NOTA (S10): el path real es /api/public/orders, no /api/orders/public.
// /api/orders* en el backend exige API key con scope orders:write o sesión
// staff (ver server.ts, app.use('/api/orders*', requireAuthMiddleware)) — un
// visitante anónimo o un cliente logueado (seul_customer_session, no es
// sesión staff) no puede pasar por ahí, así que el endpoint de checkout
// público vive en un path distinto a propósito. credentials:'include' para
// que, si hay sesión de cliente activa, el backend la use para vincular el
// pedido en vez de confiar en el customerId del body.
export async function createWebOrder(payload: {
  channel: 'web'
  deliveryMode: 'rappi' | 'metro' | 'pickup' | 'shipping'
  metroStation?: string; metroSlot?: string; deliveryDate?: string; deliveryAddress?: string
  customerId?: string
  notes?: string
  items: Array<{ productId: string; quantity: number; unitPrice: number; isBaes: boolean }>
  // Pedido B2B (adición post-entrega) — companyId siempre re-validado contra
  // la sesión en el backend, nunca confiado a secas. paymentMethod es solo
  // una preferencia declarada por el cliente al pedir; staff confirma el
  // método real después vía POST /api/orders/:id/confirm-payment.
  companyId?: string
  paymentMethod?: 'transferencia' | 'efectivo' | 'transbank' | 'credito_b2b'
}) {
  return apiFetch<{ ok: boolean; orderId: string; number: number; pdfToken: string | null; total: number }>(
    '/api/public/orders', { method: 'POST', credentials: 'include', body: JSON.stringify(payload) } as RequestInit
  )
}
