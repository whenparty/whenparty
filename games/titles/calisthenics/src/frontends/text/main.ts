import './style.css'
import {openRoom, visitNow} from '../../connection.ts'
import {mountPanel} from '../shared/panel.ts'

const interfaceLink = document.getElementById('interface-link') as HTMLAnchorElement
const panel = mountPanel(
  document.getElementById('panel')!,
  {create: () => room.create(), join: code => room.join(code), send: move => room.send(move)},
  {roomTimeOf: visitNow}
)
const announcement = document.getElementById('announcement')!
const underAnnouncement = [...document.querySelectorAll<HTMLElement>('main > *')].filter(each => !each.contains(announcement))
const room = openRoom(visit => {
  panel.render(visit)
  interfaceLink.href = `./${visit ? `#${visit.code}` : ''}`
  const covered = announcement.checkVisibility()
  underAnnouncement.forEach(each => (each.inert = covered))
})
