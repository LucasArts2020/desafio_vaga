const storageKey = 'acervo.session'
const listeners = new Set<(previous: string | null, next: string | null) => void>()
let version = 0
let expired = false

export function sessionToken() {
  return sessionStorage.getItem(storageKey)
}

export function sessionVersion() {
  return version
}

export function sessionExpired() {
  return expired
}

export function subscribeSession(listener: (previous: string | null, next: string | null) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setSessionToken(token: string | null, wasExpired = false) {
  const previous = sessionToken()
  if (previous === token) return
  if (token) sessionStorage.setItem(storageKey, token)
  else sessionStorage.removeItem(storageKey)
  version += 1
  expired = wasExpired
  listeners.forEach((listener) => listener(previous, token))
}

export function sessionHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}
