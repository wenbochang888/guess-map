import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './tests/e2e', fullyParallel: true,
 use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
 projects: [
  {name:'chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
  {name:'webkit',use:{...devices['iPhone 13']}},
 ],
 webServer: {command:'node scripts/serve.mjs',url:'http://127.0.0.1:4187',reuseExistingServer:true},
 reporter: [['list'],['html',{open:'never'}]],
});
