import { defineConfig } from 'vite'
import { version } from '../package.json'

export default defineConfig({
  define: {
    'import.meta.env.version': JSON.stringify(version),
  },
})
