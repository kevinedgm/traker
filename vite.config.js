import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : '/traker/'

  return {
    base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',

      // Use our custom SW (injectManifest injects the precache list into src/sw.js)
      strategies: 'injectManifest',
      srcDir:     'src',
      filename:   'sw.js',

      // Only include assets that actually exist
      includeAssets: ['brand/koto-logo.svg', 'icons/*.svg', 'icons/*.png'],

      manifest: {
        name: 'Traker — hábitos, metas y continuidad',
        short_name: 'Traker',
        description: 'Organiza hábitos, metas, registros y cierres diarios con una experiencia local-first.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',

        icons: [
          // PNG first — Android WebAPK install + notification icons
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          // Maskable — Android adaptive icon (rounded/squircle crops)
          {
            src: 'icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          // SVG — modern browsers (Chrome 80+, Firefox, Safari 16+)
          {
            src: 'icons/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],

        shortcuts: [
          {
            name: 'Abrir Hoy',
            short_name: 'Hoy',
            url: base,
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Abrir Rumbo',
            short_name: 'Rumbo',
            url: `${base}goals`,
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Abrir Hábitos',
            short_name: 'Hábitos',
            url: `${base}habits`,
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
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
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.js'],
    clearMocks: true,
  },
  }
})
