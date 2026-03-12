import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --dir ../.. demo:stage2",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    cwd: process.cwd(),
    timeout: 180_000,
  },
});
