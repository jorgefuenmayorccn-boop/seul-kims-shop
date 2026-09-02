import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '')
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv.toUpperCase()}`
}

// Patrones de mensajes de error de JavaScript en crudo — nunca deben llegar
// a la pantalla (auditoría S15, ver PLAN_MAESTRO sección 6). Los mensajes de
// negocio ("Stock insuficiente", "No hay turno activo", errores devueltos
// por la API) NO matchean nada de esto y pasan intactos.
const RAW_JS_ERROR_PATTERN =
  /cannot read propert|is not a function|is not defined|undefined is not an object|null is not an object|unexpected token|typeerror|referencetype|referenceerror|failed to fetch|networkerror|\bnan\b/i

/**
 * Devuelve `message` tal cual si parece un mensaje de negocio legible
 * (español, o cualquier texto que no matchee el patrón de error crudo de JS).
 * Si `message` parece un stack/mensaje de excepción de JavaScript sin
 * traducir (ej. "Cannot read properties of undefined (reading 'length')"),
 * devuelve `fallback` en su lugar — para nunca mostrarle eso a un usuario.
 */
export function friendlyErrorMessage(
  message: string | null | undefined,
  fallback = 'Ocurrió un error inesperado. Intenta de nuevo.',
): string {
  if (!message || !message.trim()) return fallback
  return RAW_JS_ERROR_PATTERN.test(message) ? fallback : message
}
