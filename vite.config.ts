import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // dev-only: vite's SPA fallback claims /hire/ before sirv can serve
      // public/hire/index.html — production hosts map it correctly. the
      // share button hands out this url; dev should answer it too.
      name: 'serve-hire-dir',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/hire' || req.url === '/hire/') req.url = '/hire/index.html'
          next()
        })
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        // split the heavy one-shot deps out of the main chunk: the editor
        // stack only matters once a file opens in raw mode, and react vendor
        // stays cacheable across deploys
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('codemirror')) return 'codemirror'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
        },
      },
    },
  },
})
