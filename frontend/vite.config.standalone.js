import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build 100% estatico — sem servidor, sem Node/Docker/WSL no computador de destino.
// Abrir dist-standalone/index.html direto no navegador (ou servir com o
// script de servidor local que acompanha o pacote).
export default defineConfig({
  base: './',                 // caminhos relativos — funciona em file:// e em qualquer subpasta
  define: {
    'import.meta.env.VITE_STANDALONE': JSON.stringify('true'),
  },
  plugins: [react()],
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
  },
});
