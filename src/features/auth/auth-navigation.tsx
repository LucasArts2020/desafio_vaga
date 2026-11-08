import { useMutation } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown, LogOut } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api, apiProblem } from '@/lib/api'
import { sessionHeaders, sessionToken, setSessionToken } from '@/lib/session-token'
import { safeReturnTo } from './return-to'
import { useSession } from './session-query'

export function AuthNavigation() {
  const session = useSession(true)
  const href = useRouterState({ select: (state) => state.location.href })
  const { refetch } = session
  const expiresAt = session.data?.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setTimeout(() => void refetch(), Math.max(0, Date.parse(expiresAt) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [expiresAt, refetch])

  const logout = useMutation({
    async mutationFn() {
      const token = sessionToken()
      if (!token) return
      setSessionToken(null)
      const revoked = await api.delete('/session', { headers: sessionHeaders(token) }).then(
        () => true,
        (error: unknown) => {
          const code = apiProblem(error)?.code
          return code === 'SESSION_EXPIRED' || code === 'SESSION_INVALID'
        },
      )
      if (!revoked) {
        throw new Error('Você saiu desta aba. A revogação da sessão não pôde ser confirmada.')
      }
    },
  })

  return (
    <>
      {session.data ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 px-2.5 sm:h-9"
              aria-label={`Menu da conta de ${session.data.user.name}`} disabled={logout.isPending}>
              <Avatar size="sm">
                <AvatarFallback>{session.data.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate lg:inline">{session.data.user.name}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-64">
            <DropdownMenuLabel className="whitespace-normal break-words">{session.data.user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()}><LogOut aria-hidden="true" /> Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild variant="outline" size="sm" className="h-11 sm:h-9">
          <Link to="/login" search={{ returnTo: safeReturnTo(href) }}>Entrar</Link>
        </Button>
      )}
      {logout.isError && <p role="alert" className="text-destructive">{logout.error.message}</p>}
    </>
  )
}
