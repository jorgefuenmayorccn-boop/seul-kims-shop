'use client'
// Servicio de impresión del POS
// Nivel 1 (óptimo):  Print Agent local en 127.0.0.1:9101 → ESC/POS directo
// Nivel 2 (fallback): Ventana popup con HTML 80mm + window.print()

import type { TicketPayload, PrintMode, PrintResult, ComandaPayload } from '@seul/pdf-templates/client'
import { renderTicketLines, renderPosReceiptHtml, renderTillZReportHtml, renderMasterZReportHtml, renderComandaHtml } from '@seul/pdf-templates/client'
import { setLastTicket, getLastTicket } from './last-ticket-store'
import type { TillZReport, MasterZReport } from './types'

const AGENT_URL   = 'http://127.0.0.1:9101'
const DETECT_TO   = 600   // ms timeout para detectar el agente

let _mode: PrintMode | null = null
let _printerName = ''

// ─── Detección ───────────────────────────────────────────────────────────────

export async function detectPrintMode(): Promise<{ mode: PrintMode; printerName: string }> {
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      signal: AbortSignal.timeout(DETECT_TO),
    })
    if (res.ok) {
      const data = await res.json() as { printer?: string; ok: boolean }
      _mode = 'agent'
      _printerName = data.printer ?? 'Impresora'
      return { mode: 'agent', printerName: _printerName }
    }
  } catch { /* agente no disponible */ }

  _mode = 'fallback'
  _printerName = 'Fallback (PDF)'
  return { mode: 'fallback', printerName: 'Fallback (PDF)' }
}

export function getCachedMode(): PrintMode { return _mode ?? 'fallback' }
export function getPrinterName(): string   { return _printerName }

// ─── Impresión ───────────────────────────────────────────────────────────────

export async function printTicket(payload: TicketPayload): Promise<PrintResult> {
  setLastTicket(payload)

  const mode = _mode ?? (await detectPrintMode()).mode

  if (mode === 'agent') {
    return printViaAgent(payload)
  }
  return printViaFallback(payload)
}

export async function reprintLast(): Promise<PrintResult> {
  const ticket = getLastTicket()
  if (!ticket) return { ok: false, mode: getCachedMode(), error: 'No hay ticket para reimprimir' }
  return printTicket({ ...ticket, isReprint: true })
}

export async function printZReport(report: TillZReport | MasterZReport): Promise<PrintResult> {
  const mode = _mode ?? (await detectPrintMode()).mode

  if (mode === 'agent') {
    try {
      const res = await fetch(`${AGENT_URL}/print`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'z-report', report }),
        signal:  AbortSignal.timeout(5000),
      })
      if (res.ok) return { ok: true, mode: 'agent' }
    } catch { /* fallthrough to HTML */ }
  }

  return printHtmlPopup(
    'tillId' in report
      ? renderTillZReportHtml(report as TillZReport)
      : renderMasterZReportHtml(report as MasterZReport),
    'fallback',
  )
}

export async function printComanda(payload: ComandaPayload): Promise<PrintResult> {
  // Comandas: siempre HTML popup (no necesita ESC/POS agent)
  return printHtmlPopup(renderComandaHtml(payload), 'fallback')
}

// ─── Helper compartido popup ─────────────────────────────────────────────────

function printHtmlPopup(html: string, mode: PrintMode): PrintResult {
  try {
    const win = window.open('', 'print_popup', 'width=420,height=820,scrollbars=yes')
    if (!win) return { ok: false, mode, error: 'Popup bloqueado por el navegador' }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
    return { ok: true, mode }
  } catch (e) {
    return { ok: false, mode, error: String(e) }
  }
}

export async function openCashDrawer(): Promise<void> {
  if (_mode !== 'agent') return
  try {
    await fetch(`${AGENT_URL}/open-drawer`, { method: 'POST', signal: AbortSignal.timeout(2000) })
  } catch { /* silencioso */ }
}

// ─── Nivel 1: Print Agent ────────────────────────────────────────────────────

async function printViaAgent(payload: TicketPayload): Promise<PrintResult> {
  try {
    const res = await fetch(`${AGENT_URL}/print`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    })

    if (res.ok) return { ok: true, mode: 'agent' }

    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
    // Agente respondió con error (sin papel, offline, etc.) — intento único sin retry automático
    return { ok: false, mode: 'agent', error: err.error ?? `HTTP ${res.status}` }

  } catch (e) {
    // Agente caído entre detecciones → fallback
    _mode = 'fallback'
    return printViaFallback(payload)
  }
}

// ─── Nivel 2: Fallback HTML popup ────────────────────────────────────────────

function printViaFallback(payload: TicketPayload): PrintResult {
  return printHtmlPopup(renderPosReceiptHtml(payload), 'fallback')
}
