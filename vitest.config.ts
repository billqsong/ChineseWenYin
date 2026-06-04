import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'libsodium-wrappers-sumo': fileURLToPath(
        new URL('./node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
