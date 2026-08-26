// PBKDF2-SHA256 con 210k iteraciones (OWASP 2023)
// Funciona nativamente en Cloudflare Workers sin dependencias externas

const ITERATIONS = 210_000
const KEY_LEN    = 32   // bytes
const SALT_LEN   = 16   // bytes

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export async function hashPassword(password: string): Promise<string> {
  const salt    = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const keyMat  = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMat,
    KEY_LEN * 8,
  )
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt.buffer)}$${toBase64(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false
  const [, , iter, saltB64, hashB64] = parts
  const salt    = fromBase64(saltB64)
  const keyMat  = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(iter) },
    keyMat,
    KEY_LEN * 8,
  )
  const expected = fromBase64(hashB64)
  const actual   = new Uint8Array(derived)
  if (expected.length !== actual.length) return false
  // Constant-time comparison
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
  return diff === 0
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
