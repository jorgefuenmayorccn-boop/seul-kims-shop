'use client'
import { useSyncExternalStore } from 'react'
import { setActiveShift } from './shift-store'
import { setActiveTillSession } from './till-session-store'
import { stopOrderEvents } from './order-events'

export interface POSUser {
  id:    string
  email: string
  name:  string
  role:  'owner' | 'admin' | 'staff' | 'delivery' | 'viewer'
}

let _user: POSUser | null = null
let _listeners: Set<() => void> = new Set()

function notifyAll() {
  _listeners.forEach(fn => fn())
}

function subscribe(callback: () => void) {
  _listeners.add(callback)
  return () => { _listeners.delete(callback) }
}

function getSnapshot(): POSUser | null {
  return _user
}

export function setCurrentUser(u: POSUser | null) {
  _user = u
  notifyAll()
}

export function getCurrentUser(): POSUser | null {
  return _user
}

export async function fetchCurrentUser(apiUrl: string): Promise<POSUser | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json() as { user: POSUser }
    setCurrentUser(data.user)
    return data.user
  } catch {
    return null
  }
}

export async function logoutUser(apiUrl: string): Promise<void> {
  await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  stopOrderEvents()
  setActiveShift(null)
  setActiveTillSession(null)
  setCurrentUser(null)
  window.location.href = '/login'
}

export function useAuthStore() {
  const user = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return { user, setCurrentUser, logoutUser }
}
