'use client'
import { useSyncExternalStore } from 'react'

export interface ActiveTillSession {
  id:             string
  sessionNumber:  number
  shiftId:        string
  openedAt:       string
  openingFloat:   number
  deviceId:       string
  openedByName?:  string
}

let _till: ActiveTillSession | null = null
let _listeners: Set<() => void> = new Set()

function notifyAll() {
  _listeners.forEach(fn => fn())
}

function subscribe(callback: () => void) {
  _listeners.add(callback)
  return () => { _listeners.delete(callback) }
}

function getSnapshot(): ActiveTillSession | null {
  return _till
}

export function setActiveTillSession(t: ActiveTillSession | null) {
  _till = t
  notifyAll()
}

export function getActiveTillSession(): ActiveTillSession | null {
  return _till
}

export async function fetchActiveTillSession(apiUrl: string, deviceId: string): Promise<ActiveTillSession | null> {
  try {
    const res = await fetch(
      `${apiUrl}/api/till-sessions/active?device_id=${encodeURIComponent(deviceId)}`,
      { credentials: 'include' }
    )
    if (!res.ok) return null
    const data = await res.json() as { tillSession: ActiveTillSession | null }
    setActiveTillSession(data.tillSession)
    return data.tillSession
  } catch {
    return null
  }
}

export function useTillSessionStore() {
  const tillSession = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return { tillSession, setActiveTillSession }
}
