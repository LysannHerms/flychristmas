import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  // GitHub Pages stellt die App unter diesem Repository-Pfad bereit.
  // Lokal bleibt die App unter dem normalen Root-Pfad erreichbar.
  base: mode === 'production' ? '/flychristmas/' : '/',
  plugins: [react()],
}))