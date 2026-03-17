import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/StoriCar/',
  build: {
    minify: 'esbuild'
  },
  esbuild: {
    drop: []
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Storicar',
        short_name: 'Storicar',
        description: 'Il diario di bordo dei tuoi consumi',
        theme_color: '#2563eb',
        background_color: '#0a0f1e',
        display: 'standalone',
        orientation: 'portrait',
        "icons": [
          {
            "src": "icon-1024.png",
            "sizes": "1024x1024",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable any"
          },
          {
            "src": "icon-384.png",
            "sizes": "384x384",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-256.png",
            "sizes": "256x256",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable any"
          },
          {
            "src": "icon-144.png",
            "sizes": "144x144",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-128.png",
            "sizes": "128x128",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-96.png",
            "sizes": "96x96",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-72.png",
            "sizes": "72x72",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-48.png",
            "sizes": "48x48",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-32.png",
            "sizes": "32x32",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "icon-16.png",
            "sizes": "16x16",
            "type": "image/png",
            "purpose": "any"
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ]
})
