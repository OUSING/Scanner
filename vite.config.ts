import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Transpile + polyfill for Android 8 (Chrome 67) WebView
    legacy({
      // Target Android 9 (Chrome 69) WebView and above — covers Android 8 too
      targets: ['chrome >= 67', 'android >= 9'],
      // Inject polyfills for Promise, async/await, generators, etc.
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      // Render legacy chunks for browsers that don't support ES modules
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
  ],
  build: {
    // Don't inline assets to reduce memory pressure on older WebViews
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 3000,
  },
});
