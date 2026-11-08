// The engine bundle: one IIFE file (engine.js) that today's tour page loads with a plain script tag and that sets
// window.pannellum, plus one CSS file (engine.css). three and Photo Sphere Viewer are bundled in (exact pins in package.json).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.ts',
      name: 'HabaitEngine',
      formats: ['iife'],
      fileName: () => 'engine.js',
    },
    rollupOptions: { output: { assetFileNames: (a) => (a.name && a.name.endsWith('.css') ? 'engine.css' : '[name][extname]') } },
  },
});
