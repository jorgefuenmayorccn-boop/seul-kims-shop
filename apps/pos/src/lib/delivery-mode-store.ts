'use client'
import { useSyncExternalStore } from 'react'

export interface DeliveryCustomer {
  id:           string | null  // null = nuevo cliente no guardado aún
  name:         string
  phone:        string
  address:      string
  commune:      string
  addressNotes: string
}

interface DeliveryState {
  mode:     'local' | 'delivery'
  customer: DeliveryCustomer | null
}

let _state: DeliveryState = { mode: 'local', customer: null }
const _listeners = new Set<() => void>()

function notify() { _listeners.forEach(fn => fn()) }

export function setDeliveryMode(mode: 'local' | 'delivery') {
  _state = { ..._state, mode, customer: mode === 'local' ? null : _state.customer }
  notify()
}

export function setDeliveryCustomer(c: DeliveryCustomer | null) {
  _state = { ..._state, customer: c }
  notify()
}

export function getDeliveryState() { return _state }

export function useDeliveryMode() {
  return useSyncExternalStore(
    fn => { _listeners.add(fn); return () => _listeners.delete(fn) },
    () => _state,
    () => _state,
  )
}
