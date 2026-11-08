import type { PasswordDigest } from './fixtures'

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toHex(new Uint8Array(bits))
}

export async function hashPassword(password: string): Promise<PasswordDigest> {
  const iterations = 210_000
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { algorithm: 'PBKDF2-SHA-256', iterations, saltHex: toHex(salt), digestHex: await derive(password, salt, iterations) }
}

export async function matchesPassword(password: string, stored: PasswordDigest) {
  const salt = new Uint8Array(stored.saltHex.length / 2)
  for (let index = 0; index < salt.length; index += 1) {
    salt[index] = Number.parseInt(stored.saltHex.slice(index * 2, index * 2 + 2), 16)
  }
  const actual = await derive(password, salt, stored.iterations)
  return actual === stored.digestHex
}
