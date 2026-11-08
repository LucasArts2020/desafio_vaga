import { toSocketIo } from '@mswjs/socket.io-binding'
import { http, HttpResponse, ws } from 'msw'
import { probeSessionPath } from '@/contracts/realtime-probe'
import type { ProbeSession } from '@/contracts/realtime-probe'
import { apiBasePath } from '@/lib/api'

let activeSession: ProbeSession | undefined
const openConnections = new Set<() => void>()

export function resetRealtimeProbe() {
  activeSession = undefined
  openConnections.forEach((disconnect) => disconnect())
}

export const probeSessionHandler = http.post(`${apiBasePath}${probeSessionPath}`, () => {
  activeSession = { id: crypto.randomUUID(), token: crypto.randomUUID() }
  return HttpResponse.json(activeSession, { status: 201 })
})

// MSW matches the Socket.IO namespace after removing the transport path.
const socketUrl = new URL('/', window.location.origin)
socketUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const socketLink = ws.link(socketUrl.href)

export const realtimeHandler = socketLink.addEventListener('connection', (connection) => {
  if (connection.client.url.searchParams.get('EIO') !== '4') {
    connection.server.connect()
    return
  }

  const { client } = toSocketIo(connection)
  const connectionId = crypto.randomUUID()

  // The binding announces a 25 s heartbeat in the handshake without sending pings.
  const heartbeat = window.setInterval(() => connection.client.send('2'), 25_000)
  const cleanup = () => {
    window.clearInterval(heartbeat)
    openConnections.delete(disconnect)
  }
  const disconnect = () => {
    cleanup()
    connection.client.close(1012, 'Probe transport restart')
  }
  openConnections.add(disconnect)
  connection.client.addEventListener('close', cleanup, { once: true })

  client.on('probe.subscribe', (_event, request: unknown) => {
    if (
      activeSession &&
      typeof request === 'object' &&
      request !== null &&
      'token' in request &&
      request.token === activeSession.token
    ) {
      client.emit('probe.private', { connectionId, sessionId: activeSession.id })
    }

    client.emit('probe.public', { connectionId })
  })

  client.on('probe.interrupt', disconnect)
})
