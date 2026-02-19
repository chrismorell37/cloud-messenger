import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/spotify-link': {
        target: 'https://api.song.link',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract the url parameter and forward to Odesli
          const url = new URL(path, 'http://localhost')
          const musicUrl = url.searchParams.get('url')
          return `/v1-alpha.1/links?url=${encodeURIComponent(musicUrl || '')}`
        },
      },
      '/api/itunes-search': {
        target: 'https://itunes.apple.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract the term parameter and forward to iTunes
          const url = new URL(path, 'http://localhost')
          const term = url.searchParams.get('term')
          return `/search?term=${encodeURIComponent(term || '')}&media=music&entity=song&limit=10`
        },
      },
      '/api/notify': {
        bypass: (_req, res) => {
          // No-op in development - just return success
          if (res) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ sent: false, reason: 'Dev mode - notifications disabled' }))
          }
          return false
        },
      },
    },
  },
})
