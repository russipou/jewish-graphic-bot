import { defineConfig, devices } from "@playwright/test";

// Playwright does not load .env files on its own; pick up EVE_CHAT_PASSWORD
// and E2E_BASE_URL from .env.local without clobbering the real environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — env vars must come from the shell.
}

export default defineConfig({
  testDir: "./e2e",
  // Login plus the full generate-and-review pipeline can approach two
  // minutes; the image assertion itself is capped at 60s inside the test.
  timeout: 180_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Containers (Codespaces, CI) mount a tiny /dev/shm, which crashes
    // Chromium on memory-heavy pages like a chat full of data-URI images.
    launchOptions: { args: ["--disable-dev-shm-usage"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
