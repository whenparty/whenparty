import './style.css'
import {openRoom, visitNow} from '../../connection.ts'
import {mountPanel} from '../shared/panel.ts'

const interfaceLink = document.getElementById('interface-link') as HTMLAnchorElement
const panel = mountPanel(
  document.getElementById('panel')!,
  {create: () => room.create(), join: code => room.join(code), send: move => room.send(move)},
  {clock: visitNow}
)
const room = openRoom(visit => {
  panel.render(visit)
  interfaceLink.href = `./${visit ? `#${visit.code}` : ''}`
})
