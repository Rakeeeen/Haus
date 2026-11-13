/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Served from the root of haus.rakeeeen.com (see public/CNAME).
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // The big libraries get files of their own: they rarely change (so a browser keeps them between deploys), and
        // the browser can fetch and parse them side by side instead of as one 1.2 MB script.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase';
          if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|@remix-run|scheduler)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  test: {
    // Pure logic in src/domain/** runs in plain node — no DOM needed yet. The Discord bot's own
    // pure modules (backend/src/**) are plain JS and test the same way.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'backend/src/**/*.test.js'],
    environment: 'node',
    // Tests that need a browser (components, hooks) say so with `// @vitest-environment jsdom` at the top of their file.
    setupFiles: ['src/setupTests.ts'],
  },
})
