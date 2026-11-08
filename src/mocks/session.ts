import type { Session } from '@/contracts/auth'
import { MockFailure } from './api-error'
import type { MockState } from './fixtures'

export function bearerToken(request: Request) {
  return /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
}

export function requireSession(state: MockState, request: Request) {
  const token = bearerToken(request)
  if (!token || !Object.hasOwn(state.sessions, token)) {
    throw new MockFailure(401, 'SESSION_INVALID', 'Entre para continuar.')
  }

  const session = state.sessions[token]
  if (session.expiresAt <= Date.now()) {
    throw new MockFailure(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const account = state.accounts.find((item) => item.id === session.userId)
  if (!account) throw new MockFailure(401, 'SESSION_INVALID', 'Entre para continuar.')
  return { token, session, account }
}

export function presentSession(state: MockState, request: Request): Session {
  const { account, session } = requireSession(state, request)
  return {
    user: { id: account.id, name: account.name, email: account.email },
    expiresAt: new Date(session.expiresAt).toISOString(),
    merge: session.merge,
  }
}
