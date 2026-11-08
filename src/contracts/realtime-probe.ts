export const socketPath = '/socket.io/'
export const probeSessionPath = '/_demo/socket-session'

export interface ProbeSession {
  token: string
  id: string
}

export interface ProbeEvents {
  'probe.public': (event: { connectionId: string }) => void
  'probe.private': (event: { connectionId: string; sessionId: string }) => void
}

export interface ProbeCommands {
  'probe.subscribe': (request: { token?: string }) => void
  'probe.interrupt': () => void
}
