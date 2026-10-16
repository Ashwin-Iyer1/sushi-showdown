import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'tests/browser', use: { baseURL: 'http://127.0.0.1:4197', viewport: { width: 1280, height: 960 } }, webServer: { command: 'npm run dev:browser', url: 'http://127.0.0.1:4197', reuseExistingServer: !process.env.CI }, reporter: 'list' });
