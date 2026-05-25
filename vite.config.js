import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',

      // Use our custom SW (injectManifest injects the precache list into src/sw.js)
      strategies: 'injectManifest',
      srcDir:     'src',
      filename:   'sw.js',

      // Only include assets that actually exist
      includeAssets: ['favicon.svg', 'icons/*.svg'],

      manifest: {
        name: 'Traker — Seguimiento de hábitos',
        short_name: 'Traker',
        description: 'Rastrea tus hábitos día a día. Offline-first, rápido y minimalista.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',

        icons: [
          // SVG — modern browsers (Chrome 80+, Firefox, Safari 16+)
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // 192 × 192 — required for Android "Add to Home Screen"
          {
            src: 'icons/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // 512 × 512 — splash screen / Play Store
          {
            src: 'icons/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // Maskable — Android adaptive icon (rounded/squircle crops)
          {
            src: 'icons/maskable-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],

        // NOTE: For production / Play Store, generate PNG versions:
        //   npx sharp-cli --input public/icons/pwa-512x512.svg
        //     --output public/icons/pwa-512x512.png resize 512
        //   npx sharp-cli --input public/icons/pwa-192x192.svg
        //     --output public/icons/pwa-192x192.png resize 192
        // Then add them here alongside the SVGs.

        shortcuts: [
          {
            name: 'Ver hábitos',
            short_name: 'Hábitos',
            url: '/',
            icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Ajustes',
            short_name: 'Ajustes',
            url: '/settings',
            icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
        ],
      },

      injectManifest: {
        // Precache all app-shell assets
        globPatterns: ['**/*.{js,css,html,svg,woff2,woff,ttf}'],
      },

      // Show a "New version available — refresh" prompt
      devOptions: {
        enabled: false, // set true to test SW in dev mode
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@composables': fileURLToPath(new URL('./src/composables', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@plugins':  fileURLToPath(new URL('./src/plugins',  import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    open: false,
  },

  build: {
    // Warn if any chunk exceeds 600 kB (default 500 kB is too tight for Vue3)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libs into their own chunk for better cache hits
        // (Vite 8 / rolldown requires manualChunks as a function)
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/vue-router')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/lucide-vue-next')) {
            return 'icons'
          }
        },
      },
    },
  },
})
