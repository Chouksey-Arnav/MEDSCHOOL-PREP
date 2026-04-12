import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: No __dirname (not available in ESM), no path.resolve().
// Vite automatically finds index.html at project root.

export default defineConfig({
  plugins: [react()],

  base: '/',

  server: {
    port: 5173,
    proxy: {
      // Dev-only: forward /api calls to a local function runner
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ['react', 'react-dom'],
          katex:  ['katex'],
        },
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'katex'],
    // Explicitly exclude Node-only packages so Vite never tries to bundle them
    exclude: ['nodemailer'],
  },
});
