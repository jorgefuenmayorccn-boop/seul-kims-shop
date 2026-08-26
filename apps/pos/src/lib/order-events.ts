'use client'
import { useSyncExternalStore, useEffect } from 'react'

export interface IncomingOrder {
  orderId:      string
  number:       number
  channel:      'web' | 'whatsapp' | 'b2b'
  total:        number
  deliveryMode: string
  metroStation?: string
  metroSlot?:   string
  notes?:       string
  itemCount:    number
  createdAt:    string
  seenAt?:      string   // undefined = unread
}

// ── Store singleton (mismo patrón que shift-store, till-session-store) ─────────

let _orders: IncomingOrder[]    = []
let _listeners: Set<() => void> = new Set()

function notify() { _listeners.forEach(fn => fn()) }

function subscribe(cb: () => void) {
  _listeners.add(cb)
  return () => { _listeners.delete(cb) }
}

function getSnapshot(): IncomingOrder[] { return _orders }

export function addIncomingOrder(order: IncomingOrder) {
  // Evitar duplicados
  if (_orders.some(o => o.orderId === order.orderId)) return
  _orders = [order, ..._orders]
  notify()
  playNotificationSound()
}

export function markOrderSeen(orderId: string) {
  _orders = _orders.map(o => o.orderId === orderId ? { ...o, seenAt: new Date().toISOString() } : o)
  notify()
}

export function markAllSeen() {
  const now = new Date().toISOString()
  _orders = _orders.map(o => o.seenAt ? o : { ...o, seenAt: now })
  notify()
}

export function removeIncomingOrder(orderId: string) {
  _orders = _orders.filter(o => o.orderId !== orderId)
  notify()
}

export function getUnreadCount(): number {
  return _orders.filter(o => !o.seenAt).length
}

// ── Hook React ────────────────────────────────────────────────────────────────

export function useIncomingOrders() {
  const orders = useSyncExternalStore(subscribe, getSnapshot, () => [])
  return orders
}

export function useUnreadCount() {
  return useSyncExternalStore(
    subscribe,
    () => _orders.filter(o => !o.seenAt).length,
    () => 0,
  )
}

// ── Connection state (for disconnect indicator) ───────────────────────────────

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'polling'
let _status: ConnectionStatus = 'disconnected'
let _statusListeners: Set<() => void> = new Set()

function notifyStatus() { _statusListeners.forEach(fn => fn()) }

export function subscribeConnectionStatus(cb: () => void) {
  _statusListeners.add(cb)
  return () => { _statusListeners.delete(cb) }
}

export function getConnectionStatus(): ConnectionStatus { return _status }

function setStatus(s: ConnectionStatus) {
  if (_status === s) return
  _status = s
  notifyStatus()
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus, () => 'disconnected' as ConnectionStatus)
}

// ── EventSource manager ───────────────────────────────────────────────────────

let _es: EventSource | null = null
let _apiUrl = ''
let _deviceId = ''
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _pollTimer: ReturnType<typeof setInterval> | null = null
let _heartbeatTimer: ReturnType<typeof setTimeout> | null = null
let _attempts = 0
const MAX_ATTEMPTS = 3
const HEARTBEAT_MS = 20_000  // reintentar si no hay mensaje en 20s
const POLL_INTERVAL_MS = 5_000

export function startOrderEvents(apiUrl: string, deviceId: string) {
  if (typeof window === 'undefined') return
  if (_es && _apiUrl === apiUrl) return

  _apiUrl   = apiUrl
  _deviceId = deviceId
  _attempts = 0
  connect()
}

export function stopOrderEvents() {
  if (_reconnectTimer)  clearTimeout(_reconnectTimer)
  if (_heartbeatTimer)  clearTimeout(_heartbeatTimer)
  if (_pollTimer)       clearInterval(_pollTimer)
  if (_es) { _es.close(); _es = null }
  _attempts = 0
  setStatus('disconnected')
}

function resetHeartbeat() {
  if (_heartbeatTimer) clearTimeout(_heartbeatTimer)
  _heartbeatTimer = setTimeout(() => {
    // No message in 30s — likely stale SSE; reconnect
    _es?.close(); _es = null
    connect()
  }, HEARTBEAT_MS)
}

function startPollingFallback() {
  if (_pollTimer) clearInterval(_pollTimer)
  setStatus('polling')
  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${_apiUrl}/api/orders?channel=web&status=nueva&limit=10`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json() as { orders?: Array<IncomingOrder> }
      for (const o of data.orders ?? []) addIncomingOrder(o)
    } catch { /* network error */ }
  }, POLL_INTERVAL_MS)
}

function connect() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
  if (_es) { _es.close(); _es = null }

  if (_attempts >= MAX_ATTEMPTS) {
    startPollingFallback()
    return
  }

  setStatus('connecting')
  const url = `${_apiUrl}/api/events/pos?clientId=${encodeURIComponent(_deviceId)}`
  _es = new EventSource(url, { withCredentials: true })

  _es.onopen = () => {
    _attempts = 0
    setStatus('connected')
    resetHeartbeat()
  }

  _es.onmessage = (e) => {
    _attempts = 0
    setStatus('connected')
    resetHeartbeat()
    try {
      const data = JSON.parse(e.data) as {
        type: string; channel: string; payload: IncomingOrder
      }
      // Solo pedidos de canales externos (web, whatsapp, b2b) — no los del propio POS
      if (data.type === 'order.created' && data.channel !== 'pos') {
        addIncomingOrder(data.payload)
      }
    } catch { /* ignore malformed */ }
  }

  _es.onerror = () => {
    if (_heartbeatTimer) clearTimeout(_heartbeatTimer)
    _es?.close()
    _es = null
    setStatus('disconnected')
    if (_attempts >= MAX_ATTEMPTS) { startPollingFallback(); return }
    const delay = Math.min(30_000, 1_000 * Math.pow(2, _attempts)) + Math.random() * 500
    _attempts++
    _reconnectTimer = setTimeout(connect, delay)
  }
}

// ── Sonido de notificación (Web Audio API — sin archivos externos) ─────────────

let _audioCtx: AudioContext | null = null

function playNotificationSound() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext()
    const ctx = _audioCtx

    // Doble bip corto (440Hz + 660Hz)
    const times = [0, 0.15]
    for (const t of times) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = t === 0 ? 440 : 660
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.12)
    }
  } catch { /* AudioContext no disponible */ }
}

// ── Hook de conexión — usar en el componente raíz del POS ─────────────────────

export function useOrderEventsConnection(apiUrl: string, deviceId: string) {
  useEffect(() => {
    if (!apiUrl || !deviceId) return
    startOrderEvents(apiUrl, deviceId)
    return () => { /* NO detener al desmontar — mantener conexión global */ }
  }, [apiUrl, deviceId])
}
