import { cookies } from 'next/headers'
import type { ProductListItem, ProductDetail, Category } from './types'

const API_URL     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const COOKIE_NAME = 'seul_session'
const TIMEOUT_MS  = 6_000

async function serverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const jar     = await cookies()
    const token   = jar.get(COOKIE_NAME)?.value
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
        ...(token ? { Cookie: `${COOKIE_NAME}=${token}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type DashboardStats = {
  ventasHoy: number; ventasAyer: number; deltaVentas: number | null
  ticketPromedio: number; pedidosActivos: number; pedidosWebSinDespachar: number
  b2bPendientes: number; vencenEstaSemana: number; stockCritico: number
  top5Productos: Array<{ productId: string; name: string; units: number; revenue: number }>
  generatedAt: string
}

const EMPTY_STATS: DashboardStats = {
  ventasHoy: 0, ventasAyer: 0, deltaVentas: null, ticketPromedio: 0,
  pedidosActivos: 0, pedidosWebSinDespachar: 0, b2bPendientes: 0,
  vencenEstaSemana: 0, stockCritico: 0, top5Productos: [], generatedAt: new Date().toISOString(),
}

export async function getDashboardStats(): Promise<DashboardStats & { apiOffline?: boolean }> {
  try { return await serverFetch<DashboardStats>('/api/dashboard/stats') }
  catch { return { ...EMPTY_STATS, apiOffline: true } }
}

type DashboardAlerts = {
  vencidos: Array<{ productId: string; name: string; quantity: number; expiresAt: string }>
  urgentes: Array<{ productId: string; name: string; quantity: number; expiresAt: string }>
  dtesFallidos: Array<{ id: string; number: number }>
  hasAlerts: boolean
}

export async function getDashboardAlerts() {
  try { return await serverFetch<DashboardAlerts>('/api/dashboard/alerts') }
  catch { return { vencidos: [], urgentes: [], dtesFallidos: [], hasAlerts: false } }
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  try { return await serverFetch<{ products: ProductListItem[]; total: number }>(`/api/products${qs}`) }
  catch { return { products: [], total: 0 } }
}

export async function getProductById(id: string) {
  try { return await serverFetch<ProductDetail>(`/api/products/id/${id}`) }
  catch { return null }
}

export async function getCategories() {
  try { return await serverFetch<{ categories: Category[] }>('/api/products/meta/categories') }
  catch { return { categories: [] } }
}

// ── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  try {
    return await serverFetch<{
      items: Array<{
        id: string; productId: string; productName: string; sku: string
        brand?: string | null; lot?: string | null; quantity: number
        expiresAt?: string | null; location: string
        coldChain: 'ambient' | 'refrigerated' | 'frozen'; isBaesEligible: boolean
        categoryName?: string | null
        expiryStatus: 'fresh' | 'warning' | 'urgent' | 'expired' | null
      }>
      total: number
    }>(`/api/inventory${qs}`)
  } catch { return { items: [], total: 0 } }
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function getRecentOrders(limit = 10) {
  try {
    return await serverFetch<{
      orders: Array<{
        id: string; number: number; channel: string; status: string
        deliveryMode: string; total: string; createdAt: string
      }>
    }>(`/api/orders?limit=${limit}`)
  } catch { return { orders: [] } }
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface CustomerListItem {
  id:             string
  name:           string
  email:          string | null
  phone:          string | null
  rut:            string | null
  createdChannel: string | null
  createdAt:      string
  orderCount:     number
  totalSpent:     number
  loyaltyBalance: number
}

export async function getCustomers(params?: { q?: string; limit?: number }) {
  const qs = new URLSearchParams({ limit: String(params?.limit ?? 100) })
  if (params?.q) qs.set('q', params.q)
  try {
    return await serverFetch<{ customers: CustomerListItem[]; total: number }>(`/api/customers?${qs}`)
  } catch { return { customers: [], total: 0 } }
}

export type CustomerDetail = {
  id: string; name: string; email: string | null; phone: string | null
  rut: string | null; documentType: string | null; documentNumber: string | null
  createdChannel: string | null; createdAt: string; lastLoginAt: string | null
  orderCount: number; totalSpent: number; loyaltyBalance: number
}

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  try {
    const d = await serverFetch<{ customer: CustomerDetail }>(`/api/customers/${id}`)
    return d.customer
  } catch { return null }
}

export type CustomerTimeline = {
  orders:  Array<{ id: string; number: number; channel: string; total: string; status: string; createdAt: string }>
  loyalty: Array<{ id: string; type: string; points: number; reason: string | null; orderId: string | null; createdAt: string }>
}

export async function getCustomerTimeline(id: string): Promise<CustomerTimeline> {
  try {
    return await serverFetch<CustomerTimeline>(`/api/customers/${id}/timeline`)
  } catch { return { orders: [], loyalty: [] } }
}
