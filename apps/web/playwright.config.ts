import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command: 'npm run dev -w @tiny/api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev -w @tiny/web',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
});
