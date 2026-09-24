import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served at https://jauregui82.github.io/cv/ (a GitHub Pages project
  // page, not the root of the jauregui82.github.io user site) - asset URLs
  // need this prefix or they 404 once deployed.
  base: '/cv/',
  plugins: [react()],
})
