// The Trystero signaling server (games/platform/signaling). Pages on localhost use one
// running locally: npm start --workspace platform/signaling
const productionServer = 'wss://signaling.when.party'
const localServer = 'ws://localhost:8080'
const localHosts = new Set(['localhost', '127.0.0.1'])

export const signalingUrlFor = (hostname: string): string => (localHosts.has(hostname) ? localServer : productionServer)
