import { http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import type { AuthResult, RegisterInput, Session } from '@/contracts/auth'
import { guestCartHeader } from '@/contracts/cart'
import { apiBasePath } from '@/lib/api'
import { MockFailure, respondToMock } from './api-error'
import { mergeGuestCart } from './cart'
import type { MockAccount, MockState } from './fixtures'
import { hashPassword, matchesPassword } from './password'
import { readMockState, updateMockState } from './repository'
import { bearerToken, presentSession, requireSession } from './session'

const sessionDuration = 60 * 60 * 1000

async function readCredentials(request: Request, register: boolean): Promise<RegisterInput> {
  const body: unknown = await request.json().catch(() => null)
  const input = body && typeof body === 'object' ? body : {}
  const email = 'email' in input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = 'password' in input && typeof input.password === 'string' ? input.password : ''
  const name = 'name' in input && typeof input.name === 'string' ? input.name.trim() : ''
  const termsAccepted = 'termsAccepted' in input && input.termsAccepted === true
  const fields: Record<string, string> = {}
  if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email.split('@').length !== 2) {
    fields.email = 'Informe um e-mail válido.'
  }
  if (!password || password.length > 128) fields.password = 'Informe uma senha válida.'
  if (register) {
    if (name.length < 2 || name.length > 100) fields.name = 'Informe um nome de 2 a 100 caracteres.'
    if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
      fields.password = 'Use pelo menos 8 caracteres, uma letra e um número.'
    }
    if (!termsAccepted) fields.termsAccepted = 'Aceite os termos para criar a conta.'
  }
  if (Object.keys(fields).length) throw new MockFailure(422, 'INVALID_FIELDS', 'Revise os campos informados.', fields)
  return { email, password, name, termsAccepted }
}

function issueSession(state: MockState, account: MockAccount, request: Request): AuthResult {
  const merge = mergeGuestCart(state, request.headers.get(guestCartHeader), account.id)
  const previous = bearerToken(request)
  if (previous) delete state.sessions[previous]
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + sessionDuration
  state.sessions[token] = { userId: account.id, expiresAt, merge }
  return {
    token,
    user: { id: account.id, name: account.name, email: account.email },
    expiresAt: new Date(expiresAt).toISOString(),
    merge,
  }
}

function invalidCredentials() {
  return new MockFailure(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
}

export const authHandlers = [
  http.post<PathParams, DefaultBodyType, AuthResult | ApiError>(`${apiBasePath}/auth/register`, ({ request }) =>
    respondToMock(async () => {
      const input = await readCredentials(request, true)
      const password = await hashPassword(input.password)
      const result = await updateMockState((state) => {
        if (state.accounts.some((account) => account.email === input.email)) {
          throw new MockFailure(409, 'EMAIL_EXISTS', 'Este e-mail já está em uso.', { email: 'Entre com este e-mail ou informe outro.' })
        }
        const account = { id: crypto.randomUUID(), name: input.name, email: input.email, password }
        state.accounts.push(account)
        return issueSession(state, account, request)
      })
      return HttpResponse.json<AuthResult>(result, { status: 201 })
    }),
  ),
  http.post<PathParams, DefaultBodyType, AuthResult | ApiError>(`${apiBasePath}/auth/login`, ({ request }) =>
    respondToMock(async () => {
      const input = await readCredentials(request, false)
      const snapshot = (await readMockState()).accounts.find((account) => account.email === input.email)
      if (!snapshot || !await matchesPassword(input.password, snapshot.password)) throw invalidCredentials()
      const result = await updateMockState((state) => {
        const account = state.accounts.find((item) => item.id === snapshot.id)
        if (!account || account.password.digestHex !== snapshot.password.digestHex) throw invalidCredentials()
        return issueSession(state, account, request)
      })
      return HttpResponse.json<AuthResult>(result)
    }),
  ),
  http.get<PathParams, never, Session | ApiError>(`${apiBasePath}/session`, ({ request }) =>
    respondToMock(async () => HttpResponse.json<Session>(presentSession(await readMockState(), request))),
  ),
  http.delete<PathParams, never, ApiError | null>(`${apiBasePath}/session`, ({ request }) =>
    respondToMock(async () => {
      await updateMockState((state) => {
        const { token } = requireSession(state, request)
        delete state.sessions[token]
      })
      return new HttpResponse<null>(null, { status: 204 })
    }),
  ),
  http.post<PathParams, never, ApiError | null>(`${apiBasePath}/_demo/session/expire`, ({ request }) =>
    respondToMock(async () => {
      await updateMockState((state) => {
        requireSession(state, request).session.expiresAt = Date.now()
      })
      return new HttpResponse<null>(null, { status: 204 })
    }),
  ),
]
