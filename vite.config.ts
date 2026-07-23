import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Nur den App-Shell (JS/CSS/Icons) vorcachen - Supabase-Aufrufe
      // (Tickets, Realtime etc.) laufen bewusst NICHT ueber den Service
      // Worker, damit nie veraltete Ticketdaten angezeigt werden.
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ticketsystem',
        short_name: 'Ticketsystem',
        description: 'Anfragen ankommen lassen, ohne dass etwas verloren geht.',
        lang: 'de',
        theme_color: '#1a73e8',
        background_color: '#fefbff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
