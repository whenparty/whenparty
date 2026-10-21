import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import type {PageEvent} from '../transport.ts'
import {onPageEvents} from '../trystero-transport.ts'

describe('onPageEvents', () => {
  const pageShow = (persisted: boolean) => Object.assign(new Event('pageshow'), {persisted})

  it('reports pagehide and a page back from the back-forward cache, until it is stopped', () => {
    const page = new EventTarget()
    const events: PageEvent[] = []
    const stop = onPageEvents(page, () => false)(event => events.push(event))

    page.dispatchEvent(new Event('beforeunload'))
    page.dispatchEvent(new Event('pagehide'))
    page.dispatchEvent(pageShow(false))
    page.dispatchEvent(pageShow(true))
    stop()
    page.dispatchEvent(new Event('pagehide'))
    page.dispatchEvent(pageShow(true))

    assert.deepEqual(events, ['gone', 'shown'])
  })

  it('reports an initially hidden page and later visibility changes', async () => {
    const page = new EventTarget()
    const events: PageEvent[] = []
    let hidden = true
    onPageEvents(page, () => hidden)(event => events.push(event))

    await Promise.resolve()
    page.dispatchEvent(new Event('visibilitychange'))
    hidden = false
    page.dispatchEvent(new Event('visibilitychange'))

    assert.deepEqual(events, ['away', 'away', 'back'])
  })
})
