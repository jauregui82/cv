import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served at https://soyjau.com via a GitHub Pages custom domain (see
  // public/CNAME) - a custom domain serves from the root, not the
  // /cv/ subpath the bare jauregui82.github.io/cv/ URL needed.
  base: '/',
  plugins: [react()],
})
