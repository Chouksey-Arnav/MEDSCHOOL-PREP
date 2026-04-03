import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ─── FIXED: Removed __dirname and resolve() from 'path'.
// __dirname does NOT exist in ES Modules ("type":"module" is set in package.json).
// Using it caused: ReferenceError: __dirname is not defined → build failed on Vercel.
// Vite already finds index.html automatically from the project root, so no
// manual rollupOptions.input is needed.

export default defineConfig({
  plugins: [react()],

  base: '/',

  server: {
    port: 5173,
    proxy: {
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
          react: ['react', 'react-dom'],
          katex: ['katex'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'katex'],
  },
});
