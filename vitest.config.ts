import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Default environment is 'node' for the (majority) plain-logic tests;
  // component tests opt into jsdom per-file via a `// @vitest-environment
  // jsdom` docblock so we don't pay the jsdom cost (or risk behavior
  // differences) for every existing test.
  test: { environment: 'node', include: ['src/**/__tests__/**/*.test.{ts,tsx}'] },
});
