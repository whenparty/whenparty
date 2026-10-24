import * as T from 'three'
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {performanceMs, type Completion, type Levels, type Profile} from '../../core/index.ts'
import {AthleteModel, disposeObject} from './athlete-model.ts'
import athleteUrl from './assets/athlete.glb?url'
import {effortOf} from '../../core/index.ts'
import {demonstrationMotion, effortProgress, performanceMotion, type Motion} from './presentation.ts'
import {exerciseApparatus} from './apparatus.ts'

export interface VisualAthlete {
  seat: string
  profile: Profile
  levels: Levels
  points: number
  score?: number
  completion?: Completion
  place?: number | null
}

export interface SceneView {
  kind: 'personal' | 'announcement' | 'results' | 'podium'
  challenge: number
  athletes: VisualAthlete[]
  activeSeat?: string
  elapsed?: number
  paused?: boolean
}

const material = (color: string) => new T.MeshStandardMaterial({color, roughness: 0.85})

export class ClubScene {
  private scene = new T.Scene()
  private camera = new T.PerspectiveCamera(36, 1, 0.1, 100)
  private renderer: T.WebGLRenderer
  private controls: OrbitControls
  private world = new T.Group()
  private actors: {model: AthleteModel; label: HTMLElement; sequence: Motion[]}[] = []
  private source: GLTF | null = null
  private view: SceneView | null = null
  private signature = ''
  private width = 6
  private resizeObserver: ResizeObserver
  private motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
  private host: HTMLElement
  private labels: HTMLElement
  private progress = document.createElement('div')
  private replayOrigin: SceneView | null = null
  private replayAt = 0
  private replayIndex = -1
  private viewAt = performance.now()

  constructor(host: HTMLElement, labels: HTMLElement, onError: (message: string) => void, onReady: () => void) {
    this.host = host
    this.labels = labels
    this.scene.background = new T.Color('#e9e6dc')
    this.scene.fog = new T.Fog('#e9e6dc', 25, 70)
    this.renderer = new T.WebGLRenderer({antialias: true, powerPreference: 'high-performance'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFSoftShadowMap
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    this.renderer.domElement.setAttribute('aria-label', 'Athletes in the Calisthenics club. Drag to turn the camera.')
    this.renderer.domElement.setAttribute('role', 'img')
    host.append(this.renderer.domElement)
    this.progress.className = 'effort-progress'
    this.progress.id = 'effort-progress'
    this.progress.hidden = true
    this.progress.setAttribute('role', 'timer')
    host.append(this.progress)
    this.scene.add(new T.HemisphereLight('#fffef0', '#8d927c', 2.5))
    const sun = new T.DirectionalLight('#fff2dc', 3)
    sun.position.set(-3, 10, 5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 10, bottom: -10, near: 0.5, far: 32})
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.018
    this.scene.add(sun)
    const fill = new T.DirectionalLight('#eef3e5', 1.2)
    fill.position.set(4, 3, -3)
    this.scene.add(fill)
    this.scene.add(this.world)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = !this.motionPreference.matches
    this.controls.enablePan = false
    this.controls.minPolarAngle = 0.55
    this.controls.maxPolarAngle = 1.48
    this.controls.minAzimuthAngle = -1.1
    this.controls.maxAzimuthAngle = 1.1
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.motionPreference.addEventListener('change', this.changeMotion)
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault()
      onError('The 3D scene was interrupted. Continue in the text interface.')
    })
    let previous = performance.now()
    this.renderer.setAnimationLoop(now => {
      const dt = Math.max(0, (now - previous) / 1000)
      previous = now
      if (this.replayOrigin) {
        const index = Math.floor((performance.now() - this.replayAt) / performanceMs)
        if (index !== this.replayIndex) this.showReplay(index)
      }
      for (const actor of this.actors) actor.model.tick(dt)
      this.updateProgress()
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      if (this.actors.length > 6) return
      const dimensions = this.actors.map(({label}) => ({width: label.offsetWidth, height: label.offsetHeight}))
      const occupied: {left: number; right: number; top: number; bottom: number}[] = []
      const width = this.host.clientWidth,
        height = this.host.clientHeight
      for (const [index, {model, label}] of this.actors.entries()) {
        const p = model.group.position
          .clone()
          .add(new T.Vector3(0, 2.02, 0))
          .project(this.camera)
        const size = dimensions[index]!
        const x = T.MathUtils.clamp(((p.x + 1) * width) / 2, size.width / 2 + 8, width - size.width / 2 - 8)
        let bottom = ((1 - p.y) * height) / 2
        const left = x - size.width / 2,
          right = x + size.width / 2
        for (let attempt = 0; attempt < 12; attempt++) {
          const collision = occupied.find(
            rect => left < rect.right + 3 && right > rect.left - 3 && bottom > rect.top - 3 && bottom - size.height < rect.bottom + 3
          )
          if (!collision) break
          bottom = collision.top - 5
        }
        bottom = Math.max(size.height + 54, bottom)
        occupied.push({left, right, top: bottom - size.height, bottom})
        label.style.left = `${x}px`
        label.style.top = `${bottom}px`
      }
    })
    new GLTFLoader()
      .loadAsync(athleteUrl)
      .then(source => {
        this.source = source
        this.rebuild()
        onReady()
      })
      .catch(() => onError('The athlete could not be loaded. Continue in the text interface.'))
    this.resize()
  }

  private updateProgress() {
    const athlete =
      this.view?.kind === 'results' && this.view.activeSeat
        ? this.view.athletes.find(each => each.seat === this.view!.activeSeat)
        : undefined
    this.progress.hidden = !athlete
    if (!athlete) return
    const effort = effortOf(athlete.completion ?? 'none', this.view!.challenge, athlete.levels),
      elapsed = (this.view!.elapsed ?? 0) + (this.view!.paused ? 0 : (performance.now() - this.viewAt) / 1000),
      progress = effortProgress(effort, elapsed, this.motionPreference.matches),
      done = effort.kind === 'hold' ? (Math.floor(progress.done * 10) / 10).toFixed(1) : progress.done,
      text = effort.kind === 'hold' ? `${done} / ${progress.total} s hold` : `${done} / ${progress.total} reps`
    if (this.progress.textContent !== text) this.progress.textContent = text
  }

  private changeMotion = () => {
    this.controls.enableDamping = !this.motionPreference.matches
    this.rebuild()
  }

  show(view: SceneView) {
    const signature = JSON.stringify({...view, elapsed: 0})
    if (signature !== this.signature) {
      this.replayOrigin = null
      this.view = view
      this.viewAt = performance.now()
      this.signature = signature
      this.rebuild()
    } else if (!this.replayOrigin) {
      this.view = view
      this.viewAt = performance.now()
      if (view.paused) {
        const actor = this.actors.find((_, i) => view.athletes[i]?.seat === view.activeSeat)
        actor?.model.play(actor.sequence, this.motionPreference.matches, view.elapsed ?? 0, true)
      }
    }
  }

  replay() {
    if (!this.view || this.view.activeSeat) return
    this.replayOrigin = this.view
    this.replayAt = performance.now()
    this.showReplay(0)
  }

  private showReplay(index: number) {
    const original = this.replayOrigin
    if (!original) return
    this.replayIndex = index
    this.viewAt = performance.now()
    if (index >= original.athletes.length) {
      this.view = original
      this.replayOrigin = null
    } else {
      const athletes = [...original.athletes].sort((a, b) => Number(a.seat) - Number(b.seat))
      this.view = {
        ...original,
        kind: 'results',
        athletes,
        activeSeat: athletes[index]!.seat,
        elapsed: (this.viewAt - this.replayAt - index * performanceMs) / 1000,
        paused: false
      }
    }
    this.rebuild()
  }

  resetCamera() {
    const personal = this.view?.kind === 'personal' || this.view?.kind === 'announcement'
    const performing = Boolean(this.view?.activeSeat)
    if (this.view && this.view.challenge > 0 && (performing || this.view.kind === 'announcement')) {
      const challenge = this.view.challenge,
        flag = challenge === 9,
        bar = challenge === 2 || challenge === 6 || challenge === 8,
        z = performing ? 1 : 0,
        min = new T.Vector3(flag ? -1.7 : -1.1, 0, z - 1.3),
        max = new T.Vector3(1.1, challenge === 6 ? 3.65 : bar || flag ? 2.8 : 2.4, z + 1.55),
        sideView = [1, 3, 4, 7, 8].includes(challenge),
        crowd = performing && this.view.athletes.length > 6,
        direction = new T.Vector3(
          flag ? (crowd ? -0.4 : -0.65) : sideView ? (crowd ? 0.45 : 1) : challenge === 6 ? 0.55 : personal ? 0.48 : 0.16,
          0.28,
          1
        ).normalize(),
        right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), direction).normalize(),
        up = new T.Vector3().crossVectors(direction, right),
        vertical = Math.tan(T.MathUtils.degToRad(this.camera.fov) / 2),
        horizontal = vertical * this.camera.aspect
      this.controls.target.copy(min).add(max).multiplyScalar(0.5)
      const points: T.Vector3[] = []
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(new T.Vector3(x, y, z))
      if (performing) {
        const waiting = this.view.athletes.length - 1,
          columns = Math.min(6, waiting)
        for (let i = 0; i < waiting; i++) {
          const count = Math.min(columns, waiting - Math.floor(i / columns) * columns),
            x = ((i % columns) - (count - 1) / 2) * 1.25,
            z = -2 - Math.floor(i / columns) * 1.5
          for (const edge of [-0.4, 0.4]) for (const y of [0, 2]) points.push(new T.Vector3(x + edge, y, z))
        }
      }
      let distance = 0
      for (const point of points) {
        point.sub(this.controls.target)
        distance = Math.max(
          distance,
          Math.abs(point.dot(right)) / horizontal + point.dot(direction),
          Math.abs(point.dot(up)) / vertical + point.dot(direction)
        )
      }
      distance *= 1.06
      this.camera.position.copy(this.controls.target).addScaledVector(direction, distance)
      this.controls.minDistance = distance * 0.7
      this.controls.maxDistance = distance * 1.5
      this.controls.update()
      return
    }
    this.controls.target.set(0, personal ? 0.85 : 0.9, 0)
    let distance = Math.max(5.1, 3.8 / this.camera.aspect)
    if (personal) this.camera.position.set(3.6, 2.55, distance)
    else if (performing) {
      this.controls.target.set(0, 0.7, 1)
      distance = Math.max(6.8, (this.view!.athletes.length > 6 ? 8.1 : 4.4) / this.camera.aspect)
      this.camera.position.set(0.6, 2.8, distance)
    } else {
      const direction = new T.Vector3(0.15, 0.53, 1).normalize()
      const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), direction).normalize()
      const up = new T.Vector3().crossVectors(direction, right)
      const vertical = Math.tan(T.MathUtils.degToRad(this.camera.fov) / 2),
        horizontal = vertical * this.camera.aspect
      const depth = this.view?.kind === 'podium' ? 4.2 : 3
      distance = 0
      for (const x of [-this.width / 2, this.width / 2])
        for (const y of [0, 3.6])
          for (const z of [-depth, depth]) {
            const corner = new T.Vector3(x, y, z).sub(this.controls.target)
            distance = Math.max(
              distance,
              Math.abs(corner.dot(right)) / horizontal + corner.dot(direction),
              Math.abs(corner.dot(up)) / vertical + corner.dot(direction)
            )
          }
      distance *= 1.06
      this.camera.position.copy(this.controls.target).addScaledVector(direction, distance)
    }
    this.controls.minDistance = personal || performing ? 3.6 : 8
    this.controls.maxDistance = Math.max(10, distance * 1.5)
    this.controls.update()
  }

  private resize() {
    const {width, height} = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.resetCamera()
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, shadow = true) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material(color))
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    this.world.add(mesh)
    return mesh
  }

  private cylinder(top: number, bottom: number, h: number, x: number, y: number, z: number, color: string) {
    const mesh = new T.Mesh(new T.CylinderGeometry(top, bottom, h, 24), material(color))
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    this.world.add(mesh)
  }

  private sign(text: string, x: number, y: number, z: number, width: number) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')!
    context.fillStyle = '#565a60'
    context.font = '500 62px sans-serif'
    context.textAlign = 'center'
    context.fillText(text, 512, 145)
    const texture = new T.CanvasTexture(canvas)
    const sign = new T.Mesh(new T.PlaneGeometry(width, width / 4), new T.MeshBasicMaterial({map: texture, transparent: true}))
    sign.position.set(x, y, z)
    sign.userData.texture = texture
    this.world.add(sign)
  }

  private personalRoom() {
    this.width = 6
    this.box(200, 0.1, 200, 0, -0.1, 0, '#ded9ca', false)
    this.box(5.7, 0.1, 5.3, 0, -0.027, -0.1, '#e8dfcd', false)
    for (let x = -2.7; x < 2.9; x += 0.38) this.box(0.009, 0.002, 5.28, x, 0.025, -0.1, '#d8cfbb', false)
    this.box(1.42, 0.055, 2.7, 0, 0.049, 0.05, '#98a38b')
    this.box(1.36, 0.004, 2.64, 0, 0.079, 0.05, '#a9b29e', false)
    this.box(5.8, 3.8, 0.14, 0, 1.85, -2.77, '#eee9df')
    this.box(0.12, 3.8, 5.5, -2.9, 1.85, -0.1, '#e7e5d9')
    this.box(1.8, 2.3, 0.07, -1.6, 2, -2.65, '#b8c2ad')
    this.box(1.65, 2.15, 0.08, -1.6, 2, -2.6, '#e2ead4')
    this.box(0.055, 2.18, 0.09, -1.6, 2, -2.54, '#d7cfbd')
    this.box(1.66, 0.055, 0.09, -1.6, 2, -2.54, '#d7cfbd')
    this.box(1.93, 0.075, 0.25, -1.6, 0.85, -2.55, '#d7cfbd')
    this.box(1.65, 0.1, 0.46, 1.45, 0.54, -2.1, '#b79b75')
    for (const x of [0.85, 2.05]) this.box(0.07, 0.5, 0.32, x, 0.27, -2.1, '#7c725c')
    this.box(0.44, 0.08, 0.34, 1.55, 0.63, -2.1, '#e9e5ce')
    this.box(0.42, 0.04, 0.32, 1.54, 0.69, -2.08, '#d4d4ba')
    this.cylinder(0.065, 0.07, 0.28, 1.03, 0.75, -2.08, '#8d9e73')
    this.cylinder(0.042, 0.042, 0.045, 1.03, 0.915, -2.08, '#5e6d4c')
    this.cylinder(0.25, 0.19, 0.4, -2.18, 0.23, -1.94, '#c1ac8a')
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996,
        leaf = new T.Mesh(new T.SphereGeometry(1, 12, 8), material('#7c8d62'))
      leaf.scale.set(0.1, 0.4, 0.055)
      leaf.position.set(-2.18 + Math.cos(a) * 0.16, 0.72 + (i % 3) * 0.12, -1.94 + Math.sin(a) * 0.17)
      leaf.rotation.set(Math.sin(a) * 0.65, a, Math.cos(a) * 0.6)
      leaf.castShadow = true
      this.world.add(leaf)
    }
    for (let i = 0; i < 2; i++) this.cylinder(0.17, 0.17, 0.055, 1.9, 0.07 + i * 0.07, -0.95, '#66715e')
    this.sign('ONE GOOD REP.', 0.75, 2.48, -2.68, 1.72)
  }

  private rebuild() {
    if (!this.view || !this.source) return
    for (const actor of this.actors) actor.model.dispose()
    this.actors = []
    this.labels.replaceChildren()
    this.labels.classList.toggle('crowded', this.view.athletes.length > 6)
    this.progress.classList.toggle('above-roster', this.view.athletes.length > 6)
    this.world.traverse(object => {
      if (object.userData.texture instanceof T.Texture) object.userData.texture.dispose()
    })
    disposeObject(this.world)
    this.world.clear()
    const personal = this.view.kind === 'personal' || this.view.kind === 'announcement'
    if (personal) this.personalRoom()
    else {
      this.width = Math.max(10, Math.min(6, this.view.athletes.length) * 2.1 + 2)
      this.box(120, 0.1, 120, 0, -0.1, 0, '#ded9ca', false)
      this.box(this.width + 2, 0.1, 10, 0, -0.025, 0, '#e8dfcd', false)
      this.box(this.width + 2, 4, 0.15, 0, 1.95, -4.8, '#eee9df')
      this.box(this.width, 0.07, 0.1, 0, 0.06, -4.65, '#8faacb')
      this.sign(this.view.kind === 'podium' ? 'THE FIRST REP CLUB.' : 'SAME CHALLENGE. YOUR WAY.', 0, 2.75, -4.69, 6)
    }
    const podium = new Map<number, {x: number; width: number; height: number; depth: number}>()
    if (this.view.kind === 'podium') {
      const counts = [1, 2, 3].map(place => this.view!.athletes.filter(a => a.place === place).length)
      const widths = counts.map(count => Math.max(2.1, Math.min(6, count) * 0.9 + 0.6))
      const depths = counts.map(count => Math.max(1.7, Math.ceil(count / 6) * 1.2 + 0.3))
      podium.set(1, {x: 0, width: widths[0]!, height: 1.05, depth: depths[0]!})
      podium.set(2, {x: -(widths[0]! + widths[1]!) / 2 - 0.2, width: widths[1]!, height: 0.7, depth: depths[1]!})
      podium.set(3, {x: (widths[0]! + widths[2]!) / 2 + 0.2, width: widths[2]!, height: 0.45, depth: depths[2]!})
      for (const [place, step] of podium) {
        this.box(step.width, step.height, step.depth, step.x, step.height / 2, 0, place === 1 ? '#8faacb' : '#c9d8ea')
        this.sign(`${place}`, step.x, step.height / 2, step.depth / 2 + 0.01, 0.8)
      }
      this.width = widths.reduce((a, b) => a + b) + 2
    }
    const placed = new Map<number | null, number>()
    this.view.athletes.forEach((athlete, i) => {
      const model = new AthleteModel(this.source!.scene, this.source!.animations)
      model.update(athlete.profile, athlete.levels)
      let x = 0,
        y = personal ? 0.084 : 0.049,
        z = 0
      if (this.view!.kind === 'podium') {
        const place = athlete.place ?? null,
          slot = placed.get(place) ?? 0
        placed.set(place, slot + 1)
        const count = this.view!.athletes.filter(a => (a.place ?? null) === place).length
        const step = place === null ? null : podium.get(place)
        const columns = Math.min(6, count),
          row = Math.floor(slot / columns),
          inRow = Math.min(columns, count - row * columns)
        x = (step?.x ?? 0) + ((slot % columns) - (inRow - 1) / 2) * 0.9
        y = (step?.height ?? 0) + 0.055
        z = step ? (row - (Math.ceil(count / columns) - 1) / 2) * 1.2 : 2.8 + row * 1.2
      } else if (!personal) {
        if (this.view!.activeSeat) {
          const waiting = this.view!.athletes.filter(a => a.seat !== this.view!.activeSeat)
          const slot = waiting.findIndex(a => a.seat === athlete.seat)
          const columns = Math.min(6, waiting.length)
          const inRow = Math.min(columns, waiting.length - Math.floor(slot / columns) * columns)
          x = slot < 0 ? 0 : ((slot % columns) - (inRow - 1) / 2) * 1.25
          z = slot < 0 ? 1 : -2 - Math.floor(slot / columns) * 1.5
          if (slot < 0) this.box(1.55, 0.04, 2.6, x, 0.025, z, '#8faacb', false)
        } else {
          const columns = Math.min(6, this.view!.athletes.length)
          const rowCount = Math.min(columns, this.view!.athletes.length - Math.floor(i / columns) * columns)
          x = ((i % columns) - (rowCount - 1) / 2) * 2.1
          z = Math.floor(i / columns) * -3 + 1.2
          this.box(1.35, 0.04, 2.5, x, 0.025, z, i % 2 ? '#c9d8ea' : '#a9b29e', false)
        }
      }
      model.group.position.set(x, y, z)
      this.world.add(model.group)
      if (this.view!.kind === 'announcement' || this.view!.activeSeat === athlete.seat) {
        const apparatus = exerciseApparatus(this.view!.challenge)
        apparatus.position.set(x, y, z)
        this.world.add(apparatus)
      }
      const sequence: Motion[] =
        this.view!.kind === 'announcement'
          ? demonstrationMotion(this.view!.challenge)
          : this.view!.kind === 'results' && athlete.seat === this.view!.activeSeat
            ? performanceMotion(athlete.completion ?? 'none', this.view!.challenge, athlete.levels)
            : this.view!.kind === 'podium'
              ? performanceMotion(athlete.completion ?? 'full', null)
              : [{clip: 'Idle_Subtle', seconds: Infinity, loop: true}]
      const label = document.createElement('div')
      label.className = `actor-label${this.view!.athletes.length > 6 ? ' compact' : ''}`
      label.classList.toggle('performing', athlete.seat === this.view!.activeSeat)
      label.textContent = `${athlete.profile.name || 'Your athlete'}${athlete.score === undefined ? '' : ` · ${athlete.score} pts`}`
      if (this.view!.kind === 'podium') label.textContent = `${athlete.profile.name} · ${athlete.points} pts`
      this.labels.append(label)
      model.play(
        sequence,
        this.motionPreference.matches,
        athlete.seat === this.view!.activeSeat
          ? (this.view!.elapsed ?? 0) + (this.view!.paused ? 0 : (performance.now() - this.viewAt) / 1000)
          : 0,
        this.view!.paused
      )
      this.actors.push({model, label, sequence})
    })
    this.resetCamera()
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.motionPreference.removeEventListener('change', this.changeMotion)
    this.controls.dispose()
    this.actors.forEach(actor => actor.model.dispose())
    disposeObject(this.world)
    this.renderer.dispose()
  }
}
