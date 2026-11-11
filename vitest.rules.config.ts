import { defineConfig } from 'vitest/config';

// Rules tests need the Firestore emulator (and Java), so they are not part of `npm run test:run`.
// Run them with `npm run test:rules`.
export default defineConfig({
  // One file at a time: every file uses the same emulator project and clears it before each test.
  test: { include: ['rules-tests/**/*.test.ts'], environment: 'node', testTimeout: 20000, hookTimeout: 30000, fileParallelism: false },
});
