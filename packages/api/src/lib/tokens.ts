// Token 16 chars para URLs de PDF en R2 (48h TTL)
// Usa crypto.getRandomValues() — disponible en Cloudflare Workers
export function generatePDFToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
