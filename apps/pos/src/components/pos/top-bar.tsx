'use client'
import { useEffect, useState, useRef } from 'react'
import { Bike, ClipboardList } from 'lucide-react'
import { IconSun, IconMoon, IconBarcode, IconPrint, IconShift, IconSettings, IconHistory } from '../icons/pos-icons'
import { formatCLP } from '@seul/ui'
import type { PrintMode } from '@seul/pdf-templates/client'
import Link from 'next/link'

interface TopBarProps {
  cashierName?:         string
  tillOpenerName?:      string
  shiftNumber?:         number
  tillSessionNumber?:   number
  totalSold?:           number
  ticketCount?:         number
  isDark:               boolean
  scannerReady?:        boolean
  printerMode?:         PrintMode
  printerName?:         string
  incomingOrderCount?:  number
  deliveryMode?:        'local' | 'delivery'
  onDeliveryModeChange?:(mode: 'local' | 'delivery') => void
  onToggleTheme:        () => void
  onReprintLast?:       () => void
  onCloseTill?:         () => void
  onCloseShift?:        () => void
  onOpenIncoming?:      () => void
  onOpenHistory?:       () => void
  onOpenComandas?:      () => void
  onLogout?:            () => void
}

export function TopBar({
  cashierName         = 'Cajera',
  tillOpenerName,
  shiftNumber,
  tillSessionNumber,
  totalSold           = 0,
  ticketCount         = 0,
  isDark,
  scannerReady        = false,
  printerMode,
  printerName         = '',
  incomingOrderCount  = 0,
  deliveryMode        = 'local',
  onDeliveryModeChange,
  onToggleTheme,
  onReprintLast,
  onCloseTill,
  onCloseShift,
  onOpenIncoming,
  onOpenHistory,
  onOpenComandas,
  onLogout,
}: TopBarProps) {
  // Show till opener only if different from logged-in cashier
  const showOpener = tillOpenerName && tillOpenerName !== cashierName
  const [time,         setTime]         = useState('')
  const [avatarMenu,   setAvatarMenu]   = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const t = setInterval(tick, 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <header
      className="flex items-center justify-between px-5 h-12 shrink-0 border-b"
      style={{
        background:  'var(--color-surface-elevated, var(--color-surface))',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Izquierda: logo + cajera */}
      <div className="flex items-center gap-4">
        <span className="font-korean font-black text-base leading-none" style={{ color: 'var(--color-brand)' }}>
          서울킴스
        </span>
        <span className="w-px h-5" style={{ background: 'var(--color-border)' }} />
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarMenu(v => !v)}
            className="flex items-center gap-2 px-1 py-0.5 rounded transition-colors hover:bg-surface"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-body"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              {cashierName.charAt(0).toUpperCase()}
            </div>
            <span className="font-body text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {cashierName}
            </span>
          </button>

          {avatarMenu && (
            <div
              className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 shadow-lg min-w-[160px]"
              style={{
                background:  'var(--color-surface-elevated)',
                border:      '1px solid var(--color-border)',
              }}
            >
              {onLogout && (
                <button
                  onClick={() => { setAvatarMenu(false); onLogout() }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-body text-left transition-colors hover:bg-surface"
                  style={{ color: 'var(--color-error)' }}
                >
                  Cerrar sesión
                </button>
              )}
            </div>
          )}
        </div>
        {(shiftNumber || tillSessionNumber) && (
          <>
            <span className="w-px h-5" style={{ background: 'var(--color-border)' }} />
            <div className="flex items-center gap-1.5">
              <IconShift size={14} color="var(--color-text-muted)" />
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {shiftNumber && `T${shiftNumber}`}
                {shiftNumber && tillSessionNumber && ' · '}
                {tillSessionNumber && `Caja #${tillSessionNumber}`}
              </span>
            </div>
            {showOpener && (
              <>
                <span className="w-px h-5" style={{ background: 'var(--color-border)' }} />
                <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  abierta por {tillOpenerName}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Centro: hora + stats turno + modo delivery */}
      <div className="flex items-center gap-5">
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
          {time}
        </span>
        {totalSold > 0 && (
          <>
            <span className="w-px h-4" style={{ background: 'var(--color-border)' }} />
            <div className="text-right">
              <p className="font-mono text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                {formatCLP(totalSold)}
              </p>
              <p className="font-body text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {ticketCount} {ticketCount === 1 ? 'venta' : 'ventas'}
              </p>
            </div>
          </>
        )}
        {onDeliveryModeChange && (
          <>
            <span className="w-px h-4" style={{ background: 'var(--color-border)' }} />
            <div
              className="flex items-center rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <button
                onClick={() => onDeliveryModeChange('local')}
                className="px-3 h-6 font-body text-xs font-semibold transition-colors"
                style={{
                  background: deliveryMode === 'local' ? 'var(--heuk-950, #0a0a0a)' : 'transparent',
                  color:      deliveryMode === 'local' ? '#f5f5f2' : 'var(--color-text-muted)',
                }}
              >
                Local
              </button>
              <button
                onClick={() => onDeliveryModeChange('delivery')}
                className="flex items-center gap-1 px-3 h-6 font-body text-xs font-semibold transition-colors"
                style={{
                  background: deliveryMode === 'delivery' ? 'var(--heuk-950, #0a0a0a)' : 'transparent',
                  color:      deliveryMode === 'delivery' ? '#f5f5f2' : 'var(--color-text-muted)',
                }}
              >
                <Bike size={11} />
                Delivery
              </button>
            </div>
          </>
        )}
      </div>

      {/* Derecha: acciones */}
      <div className="flex items-center gap-1">
        {/* Comandas — vista Kanban sin salir de POS (rol staff no tiene cmr.seoulshop.cl) */}
        {onOpenComandas && (
          <button
            onClick={onOpenComandas}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-surface"
            title="Comandas"
          >
            <ClipboardList size={14} color="var(--color-text-muted)" />
            <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Comandas
            </span>
          </button>
        )}

        {/* Badge pedidos web entrantes */}
        {onOpenIncoming && (
          <button
            onClick={onOpenIncoming}
            className="relative flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-surface"
            title="Pedidos web entrantes"
          >
            <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Web
            </span>
            {incomingOrderCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-black font-mono px-1 rounded-full"
                style={{ background: 'var(--color-brand)', color: '#fff' }}
              >
                {incomingOrderCount > 9 ? '9+' : incomingOrderCount}
              </span>
            )}
          </button>
        )}

        {/* Indicador scanner */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ opacity: scannerReady ? 1 : 0.3 }}
          title={scannerReady ? 'Scanner listo' : 'Scanner no detectado'}
        >
          <IconBarcode size={14} color="var(--color-text-muted)" />
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: scannerReady ? 'var(--color-dte-issued)' : 'var(--color-text-muted)' }}
          />
        </div>

        {/* Indicador impresora */}
        {printerMode && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded"
            title={
              printerMode === 'agent'       ? `Impresora: ${printerName}` :
              printerMode === 'fallback'    ? 'Impresora: PDF fallback' :
              'Impresora no disponible'
            }
          >
            <IconPrint size={14} color="var(--color-text-muted)" />
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  printerMode === 'agent'       ? 'var(--color-dte-issued)' :
                  printerMode === 'fallback'    ? '#f5a623' :
                  'var(--color-error)',
              }}
            />
          </div>
        )}

        {/* Reimprimir última boleta (F5) */}
        <button
          onClick={onReprintLast}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-surface"
          title="Reimprimir última boleta (F5)"
          aria-label="Reimprimir"
        >
          <IconPrint size={16} color="var(--color-text-muted)" />
        </button>

        {/* Toggle tema (Ctrl+Shift+D) */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-surface"
          title="Cambiar tema (Ctrl+Shift+D)"
          aria-label="Cambiar tema"
        >
          {isDark
            ? <IconSun  size={16} color="var(--color-text-muted)" />
            : <IconMoon size={16} color="var(--color-text-muted)" />
          }
        </button>

        {/* Settings */}
        <Link
          href="/settings"
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-surface"
          title="Configuración"
          aria-label="Configuración"
        >
          <IconSettings size={16} color="var(--color-text-muted)" />
        </Link>

        {/* Historial de caja */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-surface"
            title="Historial de ventas"
            aria-label="Historial"
          >
            <IconHistory size={16} color="var(--color-text-muted)" />
          </button>
        )}

        {/* Cerrar Caja o Cerrar Turno */}
        {(onCloseTill || onCloseShift) && (
          <>
            <span className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
            {onCloseTill && (
              <button
                onClick={onCloseTill}
                className="flex items-center gap-1.5 px-3 h-8 rounded font-body text-xs font-medium transition-colors hover:bg-surface"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cerrar Caja
              </button>
            )}
            {onCloseShift && (
              <button
                onClick={onCloseShift}
                className="flex items-center gap-1.5 px-3 h-8 rounded font-body text-xs font-medium transition-colors hover:bg-surface"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cerrar Turno
              </button>
            )}
          </>
        )}
      </div>
    </header>
  )
}
