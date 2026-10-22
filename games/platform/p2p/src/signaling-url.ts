// The Trystero signaling server (games/platform/signaling). Pages on localhost use one
// running locally: pnpm --filter @whenparty/signaling start
const productionServer = 'wss://signaling.when.party'
const localServer = 'ws://localhost:8080'
const localHosts = new Set(['localhost', '127.0.0.1'])

export const signalingUrlFor = (hostname: string): string => (localHosts.has(hostname) ? localServer : productionServer)

// Where the same server hands out TURN credentials (see turn-servers.ts)
export const turnCredentialsUrlFor = (hostname: string): string => `${signalingUrlFor(hostname).replace(/^ws/, 'http')}/turn-credentials`
