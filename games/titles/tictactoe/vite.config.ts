import {devHeaders} from '@whenparty/p2p/dev-headers'
import {defineConfig} from 'vite'

export default defineConfig({
  base: '/tictactoe/',
  server: {headers: devHeaders},
  preview: {headers: devHeaders}
})
