import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const singleWorker = process.argv.some(
  (arg) => arg === '--maxWorkers=1' || arg.startsWith('--maxWorkers=1,'),
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    pool: 'forks',
    fileParallelism: !singleWorker,
    ...(singleWorker
      ? {
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
        }
      : {}),
    teardownTimeout: 10_000,
  },
});
