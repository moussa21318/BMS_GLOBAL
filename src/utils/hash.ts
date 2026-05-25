const ITERATIONS = 100000
const KEY_LENGTH = 64
const encoder = new TextEncoder()

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function unB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}
function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export async function hash(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-512' },
    key, KEY_LENGTH * 8
  )
  return `pbkdf2_${ITERATIONS}_${b64(salt)}_${b64(derived)}`
}

export async function verify(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split('_')
  if (parts.length < 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  const salt = unB64(parts[2])
  const expected = unB64(parts.slice(3).join('_'))
  const key = await crypto.subtle.importKey('raw', encoder.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-512' },
    key, KEY_LENGTH * 8
  )
  return eq(expected, new Uint8Array(derived))
}
