import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relatiu: funciona a GitHub Pages (https://<org>.github.io/<repo>/) i a qualsevol domini
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 800 },
});
