'use client'
import { useSyncExternalStore } from 'react'

export interface ActiveShift {
  id:           string
  shiftNumber:  number
  openedAt:     string
  openingFloat: number
  deviceId:     string
}

let _shift: ActiveShift | null = null
let _listeners: Set<() => void> = new Set()

function notifyAll() {
  _listeners.forEach(fn => fn())
}

function subscribe(callback: () => void) {
  _listeners.add(callback)
  return () => { _listeners.delete(callback) }
}

function getSnapshot(): ActiveShift | null {
  return _shift
}

export function setActiveShift(s: ActiveShift | null) {
  _shift = s
  notifyAll()
}

export function getActiveShift(): ActiveShift | null {
  return _shift
}

export async function fetchActiveShift(apiUrl: string, deviceId: string): Promise<ActiveShift | null> {
  try {
    const res = await fetch(
      `${apiUrl}/api/shifts/active?device_id=${encodeURIComponent(deviceId)}`,
      { credentials: 'include' }
    )
    if (!res.ok) return null
    const data = await res.json() as { shift: ActiveShift | null }
    setActiveShift(data.shift)
    return data.shift
  } catch {
    return null
  }
}

export function useShiftStore() {
  const shift = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return { shift, setActiveShift }
}
