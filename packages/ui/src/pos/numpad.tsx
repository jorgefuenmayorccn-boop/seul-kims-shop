'use client'
import { Delete } from 'lucide-react'
import { cn } from '../lib/utils'

interface NumpadProps {
  value: string
  onChange: (v: string) => void
  mode?: 'integer' | 'decimal'  // integer=unidades, decimal=kg
  maxLength?: number
  disabled?: boolean
  className?: string
}

const KEYS = ['7','8','9','4','5','6','1','2','3','.','0','⌫'] as const

export function POSNumpad({ value, onChange, mode = 'integer', maxLength = 8, disabled, className }: NumpadProps) {
  function handleKey(key: string) {
    if (disabled) return

    if (key === '⌫') {
      onChange(value.slice(0, -1) || '0')
      return
    }
    if (key === '.' && mode === 'integer') return
    if (key === '.' && value.includes('.')) return
    if (value === '0' && key !== '.') {
      onChange(key)
      return
    }
    if (value.length >= maxLength) return

    // Máx 3 decimales para kg
    const dotIdx = value.indexOf('.')
    if (dotIdx !== -1 && key !== '⌫' && value.length - dotIdx > 3) return

    onChange(value + key)
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYS.map(key => {
        const isDelete = key === '⌫'
        const isDot = key === '.'
        const hideDot = isDot && mode === 'integer'

        return (
          <button
            key={key}
            onClick={() => handleKey(key)}
            disabled={disabled || hideDot}
            className={cn(
              'min-h-[var(--pos-hit-area-min)] rounded-lg font-mono text-xl font-semibold',
              'flex items-center justify-center',
              'transition-all duration-fast active:scale-95',
              isDelete
                ? 'bg-error/10 text-error hover:bg-error/20'
                : 'bg-elevated border border-[var(--color-border)] text-text hover:bg-surface active:bg-[var(--ink-100)]',
              (disabled || hideDot) && 'opacity-30 cursor-not-allowed',
            )}
            aria-label={isDelete ? 'Borrar' : key}
          >
            {isDelete ? <Delete size={20} /> : key}
          </button>
        )
      })}
    </div>
  )
}
