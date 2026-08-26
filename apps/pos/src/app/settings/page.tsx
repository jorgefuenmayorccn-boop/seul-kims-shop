'use client'
import { useState, useEffect } from 'react'
import { getDeviceId, getDeviceLabel, setDeviceLabel } from '@/lib/device'
import { fetchCurrentUser, logoutUser } from '@/lib/auth-store'
import { detectPrintMode } from '@/lib/print-service'
import { DriverZReportModal } from '@/components/pos/delivery/driver-z-report-modal'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface PrinterConfig {
  interface: string
  type:      string
}

interface DeliveryDriver {
  id:       string
  name:     string
  email:    string
  isActive: boolean
}

export default function SettingsPage() {
  const [user,         setUser]         = useState<{ name: string; email: string; role: string } | null>(null)
  const [deviceId,     setDeviceIdState] = useState('')
  const [deviceLabel,  setDeviceLabelState] = useState('')
  const [labelInput,   setLabelInput]   = useState('')
  const [printerMode,  setPrinterMode]  = useState<string>('—')
  const [printerName,  setPrinterName]  = useState('')
  const [printerCfg,   setPrinterCfg]  = useState<PrinterConfig | null>(null)
  const [testPrinting, setTestPrinting] = useState(false)
  const [testResult,   setTestResult]  = useState('')
  const [drivers,      setDrivers]     = useState<DeliveryDriver[]>([])
  const [zReportDriver, setZReportDriver] = useState<DeliveryDriver | null>(null)

  useEffect(() => {
    const id    = getDeviceId()
    const label = getDeviceLabel()
    setDeviceIdState(id)
    setDeviceLabelState(label)
    setLabelInput(label)

    fetchCurrentUser(API).then(u => { if (u) setUser(u) })

    fetch(`${API}/api/auth/users`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean }> }>)
      .then(d => setDrivers((d.users ?? []).filter(u => u.role === 'delivery')))
      .catch(() => {})

    detectPrintMode().then(({ mode, printerName }) => {
      setPrinterMode(mode)
      setPrinterName(printerName)
    })

    fetch('http://127.0.0.1:9101/config')
      .then(r => r.json() as Promise<PrinterConfig>)
      .then(cfg => setPrinterCfg(cfg))
      .catch(() => { /* agente no disponible */ })
  }, [])

  function handleSaveLabel() {
    setDeviceLabel(labelInput)
    setDeviceLabelState(labelInput)
  }

  async function handleTestPrint() {
    setTestPrinting(true)
    setTestResult('')
    try {
      const res = await fetch('http://127.0.0.1:9101/print', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'test' }),
        signal:  AbortSignal.timeout(5000),
      })
      setTestResult(res.ok ? '✓ Impresión de prueba enviada' : `Error HTTP ${res.status}`)
    } catch {
      setTestResult('Sin conexión con el agente de impresión')
    } finally {
      setTestPrinting(false)
    }
  }

  async function toggleDriver(driver: DeliveryDriver) {
    const next = !driver.isActive
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, isActive: next } : d))
    await fetch(`${API}/api/auth/users/${driver.id}`, {
      method:      'PUT',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ isActive: next }),
    }).catch(() => {
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, isActive: driver.isActive } : d))
    })
  }

  async function handleRedetect() {
    const result = await detectPrintMode()
    setPrinterMode(result.mode)
    setPrinterName(result.printerName)
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Dueño',
    admin: 'Admin',
    staff: 'Cajera',
    delivery: 'Repartidor',
    viewer: 'Solo lectura',
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-background)' }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-4 px-6 h-14 border-b"
        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}
      >
        <Link
          href="/"
          className="font-body text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Volver al POS
        </Link>
        <span className="w-px h-5" style={{ background: 'var(--color-border)' }} />
        <h1 className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
          Configuración
        </h1>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-8">

        {/* Sección: Impresora */}
        <Section title="Impresora Térmica">
          <Row label="Modo detectado">
            <span
              className="font-mono text-sm font-bold"
              style={{
                color: printerMode === 'agent'    ? 'var(--color-baes-eligible)'
                     : printerMode === 'fallback' ? '#f5a623'
                     : 'var(--color-error)',
              }}
            >
              {printerMode === 'agent'    ? `ESC/POS — ${printerName}` :
               printerMode === 'fallback' ? 'Fallback PDF (sin agente)' :
               'No disponible'}
            </span>
          </Row>

          {printerCfg && (
            <>
              <Row label="Interfaz">
                <span className="font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                  {printerCfg.interface}
                </span>
              </Row>
              <Row label="Tipo">
                <span className="font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                  {printerCfg.type}
                </span>
              </Row>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <ActionButton onClick={handleRedetect}>Re-detectar</ActionButton>
            <ActionButton onClick={handleTestPrint} disabled={testPrinting}>
              {testPrinting ? 'Enviando…' : 'Impresión de prueba'}
            </ActionButton>
          </div>

          {testResult && (
            <p
              className="font-body text-sm"
              style={{ color: testResult.startsWith('✓') ? 'var(--color-baes-eligible)' : 'var(--color-error)' }}
            >
              {testResult}
            </p>
          )}

          {!printerCfg && (
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              El agente ESC/POS no está activo. Inicia{' '}
              <code
                className="px-1 py-0.5 rounded font-mono"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                apps/pos/print-agent
              </code>{' '}
              para habilitar la impresora térmica.
            </p>
          )}
        </Section>

        {/* Sección: Terminal */}
        <Section title="Terminal">
          <Row label="ID del terminal">
            <span
              className="font-mono text-xs break-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="Identificador único de este dispositivo POS"
            >
              {deviceId}
            </span>
          </Row>
          <Row label="Nombre del terminal">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="Ej: Caja 1"
                className="px-2 py-1 rounded text-sm font-body focus:outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border:     '1px solid var(--color-border)',
                  color:      'var(--color-text)',
                  width:      160,
                }}
              />
              <ActionButton onClick={handleSaveLabel} disabled={labelInput === deviceLabel}>
                Guardar
              </ActionButton>
            </div>
          </Row>
        </Section>

        {/* Sección: Repartidores */}
        {drivers.length > 0 && (
          <Section title="Repartidores">
            {drivers.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div>
                  <p className="font-body text-sm" style={{ color: 'var(--color-text)' }}>{d.name}</p>
                  <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setZReportDriver(d)}
                    className="px-2 py-1 rounded font-body text-xs transition-all"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    Z-Report
                  </button>
                  <button
                    onClick={() => toggleDriver(d)}
                    className="relative inline-flex h-5 w-9 rounded-full transition-colors"
                    style={{ background: d.isActive ? 'var(--color-brand)' : 'var(--color-border)' }}
                    title={d.isActive ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: d.isActive ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Sección: Sesión */}
        <Section title="Sesión">
          {user ? (
            <>
              <Row label="Usuario">
                <span className="font-body text-sm" style={{ color: 'var(--color-text)' }}>
                  {user.name}
                </span>
              </Row>
              <Row label="Correo">
                <span className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {user.email}
                </span>
              </Row>
              <Row label="Rol">
                <span className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </Row>
              <div className="pt-1">
                <button
                  onClick={() => logoutUser(API)}
                  className="px-4 py-2 rounded font-body font-semibold text-sm transition-all"
                  style={{
                    background: 'var(--color-error-subtle)',
                    color:      'var(--color-error)',
                    border:     '1px solid var(--color-error)',
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : (
            <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Cargando sesión…
            </p>
          )}
        </Section>

        {/* Sección: Sistema */}
        <Section title="Sistema">
          <Row label="Versión">
            <span className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>
              SEUL KING OS v1.0
            </span>
          </Row>
          <Row label="API">
            <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {API}
            </span>
          </Row>
        </Section>

      </div>

      {zReportDriver && (
        <DriverZReportModal
          driverId={zReportDriver.id}
          driverName={zReportDriver.name}
          onClose={() => setZReportDriver(null)}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="font-body text-[10px] font-bold tracking-widest mb-4"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
      >
        {title.toUpperCase()}
      </h2>
      <div
        className="rounded-lg divide-y overflow-hidden"
        style={{
          background: 'var(--color-surface-elevated)',
          border:     '1px solid var(--color-border)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="font-body text-sm shrink-0" style={{ color: 'var(--color-text-muted)', minWidth: 140 }}>
        {label}
      </span>
      <div className="flex-1 flex justify-end">
        {children}
      </div>
    </div>
  )
}

function ActionButton({
  children, onClick, disabled,
}: {
  children: React.ReactNode
  onClick:  () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded font-body text-sm transition-all"
      style={{
        background: disabled ? 'var(--color-border)' : 'var(--color-surface)',
        border:     '1px solid var(--color-border)',
        color:      disabled ? 'var(--color-text-disabled)' : 'var(--color-text)',
        cursor:     disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
