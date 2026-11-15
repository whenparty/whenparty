import {expect} from '@playwright/test'
import {networkWaitMs, play, statusOf, test} from './browser-players.ts'

test("3-1 the host's status asks for a second player while a seat is free", async ({newPlayer}) => {
  const host = await newPlayer()
  await host.getByRole('button', {name: 'Start a game'}).click()
  await expect(statusOf(host)).toHaveText('Waiting for a second player. Send them the code.', {timeout: networkWaitMs})
})

test('3-1 the status tells each player whose turn it is and who won', async ({players}) => {
  const {host, guest} = players
  await expect(statusOf(host)).toHaveText('Your turn. You are X.')
  await expect(statusOf(guest)).toHaveText('You are O. X to move.')
  await play(players, [0])
  await expect(statusOf(host)).toHaveText('You are X. O to move.')
  await expect(statusOf(guest)).toHaveText('Your turn. You are O.')
  await play(players, [3, 1, 4, 2], 1)
  await expect(statusOf(host)).toHaveText('X wins.')
  await expect(statusOf(guest)).toHaveText('X wins.')
})

test("3-1 when the other player leaves during a match, the host's status says that the match is over", async ({players}) => {
  await players.guest.getByRole('button', {name: 'Leave'}).click()
  await expect(statusOf(players.host)).toHaveText('O left, so the match is over. Send the code to a new player.', {timeout: networkWaitMs})
})
