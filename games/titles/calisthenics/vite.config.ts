import {devHeaders} from '@whenparty/p2p/dev-headers'
import {defineConfig} from 'vite'

export default defineConfig({
  build: {rollupOptions: {input: {main: 'index.html', text: 'text.html'}}},
  server: {headers: devHeaders},
  preview: {headers: devHeaders}
})
