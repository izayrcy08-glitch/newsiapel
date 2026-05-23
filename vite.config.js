import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-siapel.png'],
      manifest: {
        name: 'SIAPEL',
        short_name: 'SIAPEL',
        description: 'Sistem Informasi Apel Pegawai',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo-siapel.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo-siapel.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})