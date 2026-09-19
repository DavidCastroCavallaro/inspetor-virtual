import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS = true habilita cert self-signed (necessario p/ camera/microfone/PWA no celular).
// Defina HTTPS=false p/ voltar a http simples.
const useHttps = process.env.HTTPS !== 'false';

export default defineConfig({
  server: {
    host: true,            // expõe na rede local (0.0.0.0) — acesse pelo IP do PC
    port: 7000,            // 3000/3001 costumam estar ocupadas por outros containers (Docker etc.)
    strictPort: true,      // falha em vez de pular silenciosamente pra outra porta
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: { host: true, port: 7000, strictPort: true },
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Inspetor Virtual',
        short_name: 'Inspetor',
        description: 'Vistoria industrial de ativos com IA - Offline First',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
});
