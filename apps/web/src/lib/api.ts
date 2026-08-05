const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Dashboard
export async function getDashboardStats() {
  return apiFetch<{
    ventasHoy: number
    ventasAyer: number
    deltaVentas: number | null
    ticketPromedio: number
    pedidosActivos: number
    pedidosWebSinDespachar: number
    b2bPendientes: number
    vencenEstaSemana: number
    stockCritico: number
    top5Productos: Array<{ productId: string; name: string; units: number; revenue: number }>
    generatedAt: string
  }>('/api/dashboard/stats')
}

export async function getDashboardAlerts() {
  return apiFetch<{
    vencidos: Array<{ productId: string; name: string; quantity: number; expiresAt: string }>
    urgentes: Array<{ productId: string; name: string; quantity: number; expiresAt: string }>
    dtesFallidos: Array<{ id: string; number: number }>
    hasAlerts: boolean
  }>('/api/dashboard/alerts')
}

// Inventory
export async function getInventory(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<{
    items: Array<{
      id: string
      productId: string
      productName: string
      sku: string
      brand?: string | null
      lot?: string | null
      quantity: number
      expiresAt?: string | null
      location: string
      coldChain: 'ambient' | 'refrigerated' | 'frozen'
      isBaesEligible: boolean
      categoryName?: string | null
      expiryStatus: 'fresh' | 'warning' | 'urgent' | 'expired' | null
    }>
    total: number
  }>(`/api/inventory${qs}`)
}
