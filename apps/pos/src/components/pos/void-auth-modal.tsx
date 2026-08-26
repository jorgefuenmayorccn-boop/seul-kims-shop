'use client'
import { useState, useCallback } from 'react'

interface VoidTarget {
  orderId: string
  number:  number
  total:   number
  items:   Array<{ name: string; qty: number }>
}

interface VoidAuthModalProps {
  target:  VoidTarget
  apiUrl:  string
  onVoided:    (orderId: string) => void
  onDismiss:   () => void
}

type State = 'idle' | 'loading' | 'success' | 'error'

export function VoidAuthModal({ target, apiUrl, onVoided, onDismiss }: VoidAuthModalProps) {
  const [pin, setPin]       = useState('')
  const [reason, setReason] = useState('')
  const [state, setState]   = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleDigit = useCallback((d: string) => {
    if (pin.length < 8) setPin(p => p + d)
  }, [pin])

  const handleBackspace = useCallback(() => {
    setPin(p => p.slice(0, -1))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!pin || !reason.trim()) return
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`${apiUrl}/api/orders/${target.orderId}/void`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ pin, reason: reason.trim() }),
      })
      if (res.ok) {
        setState('success')
        setTimeout(() => onVoided(target.orderId), 1000)
      } else {
        const data = await res.json() as { error?: string }
        setErrorMsg(data.error ?? `Error ${res.status}`)
        setState('error')
        setPin('')
      }
    } catch {
      setErrorMsg('Sin conexión con el servidor')
      setState('error')
      setPin('')
    }
  }, [pin, reason, target.orderId, apiUrl, onVoided])

  const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

  if (state === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-4">
          <span className="text-4xl">✓</span>
          <p className="text-lg font-semibold text-gray-900">Pedido #{target.number} anulado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Anular pedido #{target.number}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{clp(target.total)}</p>
        </div>

        {/* Items summary */}
        <div className="px-6 py-3 border-b border-gray-100 max-h-28 overflow-y-auto">
          {target.items.map((item, i) => (
            <div key={i} className="text-sm text-gray-600 flex gap-2">
              <span className="tabular-nums text-gray-400">{item.qty}×</span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>

        {/* Reason */}
        <div className="px-6 py-4 border-b border-gray-100">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
            Motivo de anulación
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ej: error en producto, cliente canceló..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder:text-gray-300"
            disabled={state === 'loading'}
          />
        </div>

        {/* PIN display */}
        <div className="px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">PIN de autorización</p>
          <div className="flex gap-2">
            {Array.from({ length: Math.max(4, pin.length + 1) }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-gray-900' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          {state === 'error' && (
            <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 border-t border-gray-100">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key) => (
            <button
              key={key}
              disabled={state === 'loading' || key === ''}
              onClick={() => key === '⌫' ? handleBackspace() : key ? handleDigit(key) : undefined}
              className={`py-4 text-lg font-medium border-b border-r border-gray-100 transition-colors
                ${key === '' ? 'bg-gray-50 cursor-default' : 'hover:bg-gray-50 active:bg-gray-100'}
                ${key === '⌫' ? 'text-gray-400' : 'text-gray-900'}
              `}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 border-t border-gray-100">
          <button
            onClick={onDismiss}
            disabled={state === 'loading'}
            className="py-4 text-sm font-medium text-gray-500 border-r border-gray-100 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={state === 'loading' || !pin || !reason.trim()}
            className="py-4 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {state === 'loading' ? 'Anulando...' : 'Anular pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
