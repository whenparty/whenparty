import './style.css'
import {openRoom, type Room} from '../../connection.ts'
import {mountPanel} from '../shared/panel.ts'

const interfaceLink = document.getElementById('interface-link') as HTMLAnchorElement
let room: Room | null = null
const panel = mountPanel(
  document.getElementById('panel')!,
  {
    create: () => room?.create(),
    submit: text => room?.submit(text) ?? true,
    leave: () => room?.leave(),
    startChampionship: () => room?.startChampionship(),
    send: move => room?.send(move)
  },
  {roomTime: () => room?.roomTime() ?? 0}
)
const announcement = document.getElementById('announcement')!
const underAnnouncement = [...document.querySelectorAll<HTMLElement>('main > *')].filter(each => !each.contains(announcement))
room = openRoom(visit => {
  panel.render(visit)
  interfaceLink.href = `./${visit?.code ? `#${visit.code}` : ''}`
  const covered = announcement.checkVisibility()
  underAnnouncement.forEach(each => (each.inert = covered))
})
