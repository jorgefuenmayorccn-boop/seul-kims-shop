// Almacén del último ticket impreso — para F5 / reimpresión
// localStorage con TTL 8h para sobrevivir cierre de tab/navegador

import type { TicketPayload } from '@seul/pdf-templates/client'

const LS_KEY  = 'seul_last_ticket'
const TTL_MS  = 8 * 60 * 60 * 1000

interface Stored { payload: TicketPayload; expiresAt: number }

let _last: TicketPayload | null = null

export function setLastTicket(t: TicketPayload): void {
  _last = t
  try {
    const entry: Stored = { payload: t, expiresAt: Date.now() + TTL_MS }
    localStorage.setItem(LS_KEY, JSON.stringify(entry))
  } catch { /* quota o SSR */ }
}

export function getLastTicket(): TicketPayload | null {
  if (_last) return _last
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Stored
    if (Date.now() > entry.expiresAt) { localStorage.removeItem(LS_KEY); return null }
    _last = entry.payload
    return _last
  } catch { /* parse error */ }
  return null
}

export function clearLastTicket(): void {
  _last = null
  try { localStorage.removeItem(LS_KEY) } catch { /* */ }
}
