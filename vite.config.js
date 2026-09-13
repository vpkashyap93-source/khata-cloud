import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this from https://<user>.github.io/khata-cloud/, so
// a production build there needs that subpath as its base. Vercel serves
// from the domain root instead, and its own build step sets VERCEL=1
// automatically - detected here so the same repo deploys correctly to
// either host with no manual config. Local dev is always served from the
// root either way.
export default defineConfig(({ command }) => ({
  base: command === 'build' && !process.env.VERCEL ? '/khata-cloud/' : '/',
  plugins: [react()],
}))
