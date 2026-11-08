import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { probeSessionPath, socketPath } from '@/contracts/realtime-probe'
import type { ProbeCommands, ProbeEvents, ProbeSession } from '@/contracts/realtime-probe'
import { api } from '@/lib/api'

type ProbeSocket = Socket<ProbeEvents, ProbeCommands>

const connectionLabels = {
  connecting: 'Conectando…',
  connected: 'Conectado.',
  reconnecting: 'Reconectando…',
  failed: 'Falha de conexão. Tentando novamente…',
}

function ProbeConnection({ token }: { token?: string }) {
  const socketRef = useRef<ProbeSocket | null>(null)
  const [status, setStatus] = useState<keyof typeof connectionLabels>('connecting')
  const [publicCount, setPublicCount] = useState(0)
  const [privateCount, setPrivateCount] = useState(0)
  const [connectionId, setConnectionId] = useState('')
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    const socket: ProbeSocket = io({
      path: socketPath,
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelay: 300,
      randomizationFactor: 0,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('connected')
      socket.emit('probe.subscribe', { token })
    })
    socket.on('disconnect', () => {
      setStatus('reconnecting')
    })
    socket.on('connect_error', () => {
      setStatus('failed')
    })
    socket.on('probe.public', (event) => {
      setPublicCount((count) => count + 1)
      setConnectionId(event.connectionId)
    })
    socket.on('probe.private', (event) => {
      setPrivateCount((count) => count + 1)
      setSessionId(event.sessionId)
    })
    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  return (
    <>
      <p aria-live="polite">{connectionLabels[status]}</p>
      <dl className="space-y-1 break-all text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt>Eventos públicos</dt>
          <dd data-testid="public-event-count">{publicCount}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Eventos privados</dt>
          <dd data-testid="private-event-count">{privateCount}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Conexão recebida</dt>
          <dd data-testid="probe-connection-id">{connectionId || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Sessão recebida</dt>
          <dd data-testid="private-session-id">{sessionId || '—'}</dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        disabled={status !== 'connected'}
        onClick={() => socketRef.current?.emit('probe.interrupt')}
      >
        Interromper conexão de teste
      </Button>
    </>
  )
}

export default function RealtimeProbe() {
  const session = useMutation({
    async mutationFn() {
      const { data } = await api.post<ProbeSession>(probeSessionPath)
      return data
    },
  })

  return (
    <section aria-labelledby="realtime-probe-title" className="space-y-4 border-t border-input pt-6">
      <h2 id="realtime-probe-title" className="text-xl font-semibold">Diagnóstico Socket.IO</h2>
      <div className="flex flex-wrap gap-2">
        <Button disabled={session.isPending || !!session.data} onClick={() => session.mutate()}>
          Iniciar sessão de teste
        </Button>
        <Button variant="secondary" disabled={!session.data} onClick={() => session.reset()}>
          Voltar a visitante
        </Button>
      </div>
      {session.isError && <p role="alert">A sessão de teste não pôde ser criada.</p>}
      {session.data && (
        <p className="break-all text-sm">Sessão emitida <span data-testid="issued-session-id">{session.data.id}</span></p>
      )}
      <ProbeConnection key={session.data?.id ?? 'guest'} token={session.data?.token} />
    </section>
  )
}
