import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build also runs from disk inside the desktop app.
  base: './',
  plugins: [react()],
})
