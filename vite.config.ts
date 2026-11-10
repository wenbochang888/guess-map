import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [vue()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  build: {
    target: ['es2017', 'chrome61'],
    cssTarget: 'chrome61',
    sourcemap: false,
    cssCodeSplit: false,
    lib: { entry: 'src/main.ts', name: 'GuessMap', formats: ['iife'], fileName: () => 'app.js', cssFileName: 'style' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
