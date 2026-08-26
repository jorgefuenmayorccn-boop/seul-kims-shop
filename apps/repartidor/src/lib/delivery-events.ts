import { useEffect } from 'react'

export interface DispatchAlert {
  orderId:         string
  orderNumber:     number
  assignmentId:    string | null
  driverId:        string | null
  total:           string
  amountToCollect: number
  paymentAtDoor:   string
  deliveryMode:    string
  // Datos del cliente y dirección (delivery propio)
  customerName:    string | null
  customerPhone:   string | null
  deliveryAddress: string | null
  commune:         string | null
  metroStation:    string | null
  metroSlot:       string | null
}

type AlertCallback = (alert: DispatchAlert) => void

// ── Singleton SSE manager ────────────────────────────────────────────────────

let _es:            EventSource | null       = null
let _apiUrl         = ''
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _attempts       = 0
let _onAlert:       AlertCallback | null     = null
const MAX_ATTEMPTS  = 10

export function setDispatchAlertHandler(fn: AlertCallback | null) {
  _onAlert = fn
}

export function startDeliveryEvents(apiUrl: string) {
  if (typeof window === 'undefined') return
  if (_es && _apiUrl === apiUrl) return
  _apiUrl   = apiUrl
  _attempts = 0
  connect()
}

export function stopDeliveryEvents() {
  if (_reconnectTimer) clearTimeout(_reconnectTimer)
  if (_es) { _es.close(); _es = null }
  _attempts = 0
}

function connect() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
  if (_es) { _es.close(); _es = null }
  if (_attempts >= MAX_ATTEMPTS) return

  _es = new EventSource(`${_apiUrl}/api/events/delivery`, { withCredentials: true })

  _es.onmessage = (e: MessageEvent) => {
    _attempts = 0
    try {
      const data = JSON.parse(e.data as string) as { type: string; payload: DispatchAlert }
      if (data.type === 'order.ready_for_dispatch' && _onAlert) {
        _onAlert(data.payload)
      }
    } catch { /* ignore malformed */ }
  }

  _es.onerror = () => {
    _es?.close()
    _es = null
    if (_attempts >= MAX_ATTEMPTS) return
    const delay = Math.min(30_000, 1_000 * Math.pow(2, _attempts)) + Math.random() * 500
    _attempts++
    _reconnectTimer = setTimeout(connect, delay)
  }
}

// ── Hook React ───────────────────────────────────────────────────────────────

export function useDeliveryEvents(
  apiUrl: string,
  onDispatchAlert: AlertCallback,
) {
  useEffect(() => {
    if (!apiUrl) return
    setDispatchAlertHandler(onDispatchAlert)
    startDeliveryEvents(apiUrl)
    return () => { setDispatchAlertHandler(null) }
  }, [apiUrl, onDispatchAlert])
}
