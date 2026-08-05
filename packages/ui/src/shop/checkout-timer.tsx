'use client'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '../lib/utils'

interface CheckoutTimerProps {
  durationMs?: number   // default 20 min
  onExpire?: () => void
}

export function CheckoutTimer({ durationMs = 20 * 60 * 1000, onExpire }: CheckoutTimerProps) {
  const [msLeft, setMsLeft] = useState(durationMs)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => {
      const remaining = durationMs - (Date.now() - start)
      if (remaining <= 0) {
        setMsLeft(0)
        setExpired(true)
        clearInterval(t)
        onExpire?.()
      } else {
        setMsLeft(remaining)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [durationMs, onExpire])

  const mins = Math.floor(msLeft / 60000)
  const secs = Math.floor((msLeft % 60000) / 1000)
  const urgent = msLeft < 3 * 60 * 1000 && !expired

  if (expired) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-success-subtle)] rounded-lg text-success text-sm font-body">
        <Clock size={14} />
        Reactivamos tu carrito, tómate el tiempo que necesites.
      </div>
    )
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body',
      urgent
        ? 'bg-warning/10 text-yellow-700'
        : 'bg-surface text-text-muted',
    )}>
      <Clock size={14} className={urgent ? 'animate-pulse' : ''} />
      <span>
        Tu carrito se guarda por{' '}
        <span className="font-mono font-bold">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>{' '}
        min
      </span>
    </div>
  )
}
