import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/khata-cloud/ in production, so
// assets need that subpath as their base - but not in local dev, where
// the app is served from the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/khata-cloud/' : '/',
  plugins: [react()],
}))
