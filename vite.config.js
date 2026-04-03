import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/*
  ┌─────────────────────────────────────────────────────────────────┐
  │  MedSchoolPrep — Vite Config                                     │
  │                                                                   │
  │  URL structure (production, managed by vercel.json):             │
  │    /              → dist/landing.html  (landing page)            │
  │    /app           → dist/index.html   (React SPA shell)          │
  │    /api/*         → api/*.js           (Vercel serverless)       │
  │                                                                   │
  │  Development:                                                     │
  │    npm run dev    → http://localhost:5173  (React SPA)           │
  │    vercel dev     → http://localhost:3000  (full stack)          │
  └─────────────────────────────────────────────────────────────────┘
*/

export default defineConfig({
  plugins: [react()],

  // The React app is served at root in Vite dev, but at /app in production.
  // Keep base as '/' so asset paths resolve correctly in both environments.
  base: '/',

  // Vite will automatically copy everything in /public → /dist during build.
  // This includes: public/landing.html → dist/landing.html
  publicDir: 'public',

  server: {
    port: 5173,
    open: false,
    proxy: {
      // Proxy /api/* → vercel dev (run `vercel dev` in a second terminal on port 3000)
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
      input: {
        // Main SPA entry (Vite renders this as index.html)
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Split large dependencies into separate cacheable chunks
        manualChunks: {
          react:  ['react', 'react-dom'],
          katex:  ['katex'],
        },
        // Deterministic chunk naming for long-term caching
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  // Resolve aliases for cleaner imports within src/
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Optimise dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'katex'],
  },
});
