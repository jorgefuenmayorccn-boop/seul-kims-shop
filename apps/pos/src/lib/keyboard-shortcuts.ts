'use client'
import { useEffect } from 'react'

export interface POSShortcutHandlers {
  onFocusSearch?:   () => void  // F1
  onClearCart?:     () => void  // F2
  onToggleBAES?:    () => void  // F7
  onReprintLast?:   () => void  // F5
  onOpenCheckout?:  () => void  // Enter (con carrito lleno)
  onCloseModal?:    () => void  // Esc
  onToggleTheme?:   () => void  // Ctrl+Shift+D
  onCartUp?:        () => void  // ArrowUp
  onCartDown?:      () => void  // ArrowDown
  onCartIncrease?:  () => void  // +
  onCartDecrease?:  () => void  // -
}

export function useKeyboardShortcuts(handlers: POSShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // No interceptar si el foco está en un input
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA'

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          handlers.onFocusSearch?.()
          break
        case 'F2':
          e.preventDefault()
          handlers.onClearCart?.()
          break
        case 'F5':
          e.preventDefault()
          handlers.onReprintLast?.()
          break
        case 'F7':
          e.preventDefault()
          handlers.onToggleBAES?.()
          break
        case 'Enter':
          if (!isEditable) {
            e.preventDefault()
            handlers.onOpenCheckout?.()
          }
          break
        case 'Escape':
          handlers.onCloseModal?.()
          break
        case 'ArrowUp':
          if (!isEditable) {
            e.preventDefault()
            handlers.onCartUp?.()
          }
          break
        case 'ArrowDown':
          if (!isEditable) {
            e.preventDefault()
            handlers.onCartDown?.()
          }
          break
        case '+':
          if (!isEditable) handlers.onCartIncrease?.()
          break
        case '-':
          if (!isEditable) handlers.onCartDecrease?.()
          break
        case 'd':
        case 'D':
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault()
            handlers.onToggleTheme?.()
          }
          break
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
