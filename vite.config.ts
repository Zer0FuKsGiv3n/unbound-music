import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Unbound Music',
        short_name: 'Unbound',
        description: 'Free, ad-free music streaming powered by YouTube',
        theme_color: '#1A0A2E',
        background_color: '#1A0A2E',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="48" fill="%231A0A2E"/><text y="144" font-size="120" x="24">🎵</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="128" fill="%231A0A2E"/><text y="384" font-size="320" x="64">🎵</text></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.youtube\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'youtube-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 604800
              }
            }
          },
          {
            urlPattern: /^https:\/\/superagent-4f645ca0\.base44\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 3600
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false
  }
});
