import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { ApiError } from '@/contracts/api-error'
import type { AuthResult, LoginInput, RegisterInput } from '@/contracts/auth'
import { guestCartHeader } from '@/contracts/cart'
import { clearGuestCart, guestCartToken } from '@/features/cart/guest-cart'
import { api, apiProblem } from '@/lib/api'
import { sessionHeaders, sessionToken, sessionVersion, setSessionToken } from '@/lib/session-token'
import { sessionOptions } from './session-query'

class FormFailure extends Error {
  constructor(message: string, readonly fields?: ApiError['fieldErrors']) {
    super(message)
  }
}

export function AuthPage({ register, returnTo, expired }: { register: boolean; returnTo?: string; expired?: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pendingInput = useRef<LoginInput | RegisterInput | null>(null)
  const [confirmationError, setConfirmationError] = useState(false)
  const submit = useMutation({
    gcTime: 0,
    async mutationFn() {
      const input = pendingInput.current
      pendingInput.current = null
      if (!input) throw new FormFailure('Preencha os dados para continuar.')

      const version = sessionVersion()
      const previous = sessionToken()
      const guest = guestCartToken()
      const headers = {
        ...(previous ? sessionHeaders(previous) : {}),
        ...(guest ? { [guestCartHeader]: guest } : {}),
      }
      try {
        const { data } = await api.post<AuthResult>(register ? '/auth/register' : '/auth/login', input, { headers })
        return { data, version }
      } catch (error) {
        const problem = apiProblem(error)
        if (problem?.code === 'GUEST_CART_CLAIMED' && guestCartToken() === guest) clearGuestCart()
        throw new FormFailure(problem?.message ?? 'A autenticação falhou. Tente novamente.', problem?.fieldErrors)
      }
    },
  })
  const fields = submit.error instanceof FormFailure ? submit.error.fields : undefined

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submit.isPending || pendingInput.current) return
    submit.reset()
    const data = new FormData(event.currentTarget)
    const input = { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') }
    const mismatch = register && input.password !== data.get('confirmation')
    setConfirmationError(mismatch)
    if (mismatch) return

    pendingInput.current = register
      ? { ...input, name: String(data.get('name') ?? ''), termsAccepted: data.has('termsAccepted') }
      : input

    submit.mutate(undefined, {
      onSuccess({ data: { token, ...session }, version }) {
        if (sessionVersion() !== version) return
        clearGuestCart()
        queryClient.removeQueries({ queryKey: ['cart', 'guest'] })
        queryClient.setQueryData(sessionOptions(token).queryKey, session)
        setSessionToken(token)
        void navigate({ href: returnTo ?? '/', replace: true })
      },
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="hidden space-y-4 rounded-lg border border-input/60 bg-secondary/30 p-6 lg:block">
        <img src="/art/orbita.svg" width={800} height={520} alt="Anel metálico sobre pedestal escuro" className="rounded-md" />
        <p className="text-2xl font-semibold">O próximo capítulo da arte é seu.</p>
        <p className="text-sm text-muted-foreground">Obras originais. Artistas independentes. Uma nova maneira de fazer parte da história.</p>
      </div>
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{register ? 'Seu olhar, sua coleção' : 'Bom ter você de volta'}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{register ? 'Comece seu Acervo.' : 'Entre no seu Acervo.'}</h1>
        {expired && <p role="status" className="rounded-md bg-secondary p-3">Sua sessão expirou. Entre novamente para continuar.</p>}
        {returnTo === '/checkout' && <p className="text-muted-foreground">Sua seleção estará disponível na revisão do checkout.</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          {register && (
            <div>
              <label htmlFor="auth-name" className="text-sm">Nome completo</label>
              <input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={100}
                aria-invalid={!!fields?.name} aria-describedby={fields?.name ? 'auth-name-error' : undefined} className="field" />
              {fields?.name && <p id="auth-name-error" className="mt-1 text-sm text-destructive">{fields.name}</p>}
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="text-sm">E-mail</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254}
              aria-invalid={!!fields?.email} aria-describedby={fields?.email ? 'auth-email-error' : undefined} className="field" />
            {fields?.email && <p id="auth-email-error" className="mt-1 text-sm text-destructive">{fields.email}</p>}
          </div>
          <div>
            <label htmlFor="auth-password" className="text-sm">Senha</label>
            <input id="auth-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
              required minLength={register ? 8 : undefined} maxLength={128}
              aria-invalid={!!fields?.password} aria-describedby={fields?.password ? 'auth-password-error' : undefined} className="field" />
            {fields?.password && <p id="auth-password-error" className="mt-1 text-sm text-destructive">{fields.password}</p>}
          </div>
          {register && (
            <>
              <div>
                <label htmlFor="auth-confirmation" className="text-sm">Confirmar senha</label>
                <input id="auth-confirmation" name="confirmation" type="password" autoComplete="new-password" required maxLength={128}
                  aria-invalid={confirmationError} aria-describedby={confirmationError ? 'auth-confirmation-error' : undefined} className="field" />
                {confirmationError && <p id="auth-confirmation-error" role="alert" className="mt-1 text-sm text-destructive">As senhas precisam coincidir.</p>}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="termsAccepted" required className="mt-0.5 accent-primary"
                  aria-describedby={fields?.termsAccepted ? 'auth-terms-error' : undefined} />
                Aceito os termos da demonstração.
              </label>
              {fields?.termsAccepted && <p id="auth-terms-error" className="text-sm text-destructive">{fields.termsAccepted}</p>}
            </>
          )}
          {submit.isError && <p role="alert" className="text-sm text-destructive">{submit.error.message}</p>}
          <Button type="submit" disabled={submit.isPending} className="w-full">
            {submit.isPending ? 'Enviando…' : register ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          {register ? 'Já tem uma conta? ' : 'Ainda não coleciona com a gente? '}
          <Link to={register ? '/login' : '/cadastro'} search={{ returnTo, expired }} className="text-primary underline">
            {register ? 'Entrar' : 'Criar conta'}
          </Link>
        </p>
      </section>
    </div>
  )
}
