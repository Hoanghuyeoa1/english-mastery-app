import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'English Mastery Hub - Luyện Tiếng Anh Cá Nhân Hóa',
        short_name: 'MasteryHub',
        description: 'Học tiếng Anh 4 kỹ năng với SM-2, siêu từ điển offline và trợ lý AI.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:mp3|wav|ogg|m4a)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'toeic-audio-runtime-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Tách riêng toàn bộ dữ liệu tĩnh từ điển & từ vựng thành 1 chunk độc lập
          if (
            id.includes('vocab10000.json') ||
            id.includes('vocab5000.json') ||
            id.includes('vocab1000.json') ||
            id.includes('vocabularyData') ||
            id.includes('defaultVocab') ||
            id.includes('fullDictionaryData') ||
            id.includes('toeicQuestionsData')
          ) {
            return 'vocab-static-data';
          }
          // Tách vendor thư viện
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('canvas-confetti')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 10000,
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    pool: 'threads',
    exclude: ['**/node_modules/**', '**/dist/**', '**/archive/**'],
  },
})
