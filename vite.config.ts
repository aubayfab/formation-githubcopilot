import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    open: true,
    host: '127.0.0.1'
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
