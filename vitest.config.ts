import path from 'node:path'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Nested git worktrees (e.g. .claude/worktrees/<name>/) contain a full
    // copy of the project — without this, running tests from the main
    // checkout doubles up on every test file found inside them.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
