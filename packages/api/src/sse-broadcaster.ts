// ============================================================================
// SSE BROADCASTER (S08, Fase 2) — single in-process fan-out, no per-client
// Postgres connection/listener and no per-client polling `setInterval`.
//
// This is the exact pattern the plan maestro warns about repeating: Railway/
// Neon has a small connection pool (`packages/api/src/db.ts` → `max: 10`).
// If every SSE-connected client opened its own DB connection or ran its own
// interval query, a handful of concurrent POS/repartidor tablets would
// exhaust the pool and take the whole system down — this already happened
// once in the VÉRTICE CRM project and is documented there as a resolved
// blocker ("SSE pool exhaustion").
//
// Instead: ONE Node `EventEmitter` lives in this module for the life of the
// process. Route handlers that mutate state (order creation, driver
// assignment) call `emitPosEvent`/`emitDeliveryEvent` directly at the moment
// of the change — no polling. Each SSE HTTP request registers a listener
// here and unregisters it when the connection closes. Zero extra DB
// connections are opened per SSE client; zero queries run on a timer per
// client.
// ============================================================================

import { EventEmitter } from 'events'

const emitter = new EventEmitter()
// Many tablets/browsers can hold an SSE connection open at once — this is
// in-memory listener count, not DB connections, so raising the cap is safe.
emitter.setMaxListeners(0)

const POS_EVENT = 'pos'
const deliveryEventKey = (driverId: string) => `delivery:${driverId}`

// ── POS channel — broadcast to every connected POS terminal ────────────────
// (cerebro/pos staff watching for new multi-channel orders: web/whatsapp/b2b)

export function emitPosEvent(payload: unknown): void {
  emitter.emit(POS_EVENT, payload)
}

export function onPosEvent(cb: (payload: unknown) => void): () => void {
  emitter.on(POS_EVENT, cb)
  return () => emitter.off(POS_EVENT, cb)
}

// ── Delivery channel — targeted to ONE driver ───────────────────────────────
// Never broadcast a dispatch alert to every repartidor: the frontend
// (`apps/repartidor/src/app/page.tsx`) accepts an alert by PUTting
// `/api/delivery/assignments/:id/status` with that exact `assignmentId` —
// if a driver who isn't actually assigned received the alert, tapping
// "ACEPTAR VIAJE" would 403 (or worse, race another driver). Keying the
// emitter by driverId (always `authUser.id` from the session that requested
// the SSE stream, never a client-supplied id) keeps that invariant.

export function emitDeliveryEvent(driverId: string, payload: unknown): void {
  emitter.emit(deliveryEventKey(driverId), payload)
}

export function onDeliveryEvent(driverId: string, cb: (payload: unknown) => void): () => void {
  const key = deliveryEventKey(driverId)
  emitter.on(key, cb)
  return () => emitter.off(key, cb)
}
