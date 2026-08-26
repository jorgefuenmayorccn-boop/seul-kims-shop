'use client'
import { useEffect, useRef } from 'react'

// Detecta secuencias de teclado del scanner (HID-Keyboard mode)
// El scanner emite caracteres rápidos + Enter al final.
// Si llegan ≥6 chars en <100ms sin foco en input text → es un scan.

const SCANNER_TIMEOUT_MS = 100
const MIN_BARCODE_LENGTH = 6

export function useBarcodeScanner(onScan: (code: string) => void) {
  const bufferRef = useRef('')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function flush() {
      const code = bufferRef.current.trim()
      bufferRef.current = ''
      if (code.length >= MIN_BARCODE_LENGTH) onScan(code)
    }

    function onKeyDown(e: KeyboardEvent) {
      // Si el foco está en un input de texto, dejamos que escriba normalmente
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (isEditable) return

      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current)
        flush()
        return
      }

      // Solo acumular caracteres alfanuméricos y guiones (EAN/UPC/Code128)
      if (e.key.length === 1 && /[\w\-]/.test(e.key)) {
        bufferRef.current += e.key

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          // Si pasaron 100ms sin Enter, descartamos (no era scanner)
          bufferRef.current = ''
        }, SCANNER_TIMEOUT_MS)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onScan])
}
