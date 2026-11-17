import { defineConfig, devices } from "@playwright/test";
import { API_PORT as API, WEB_PORT as WEB } from "./e2e/ports";

// End-to-end tests (FP-18) against a production build (so the service worker works offline)
// and a fresh in-memory server, on their own ports so they don't clash with `npm run dev`.

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 1, // the tests share one server
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${WEB}`, trace: "retain-on-failure" },
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../server",
      env: { PORT: String(API), DB_PATH: ":memory:", AUTH_RATE_LIMIT: "1000" }, // many test accounts per run
      url: `http://localhost:${API}/api/health`,
    },
    {
      command: `npx vite build && npx vite preview --port ${WEB} --strictPort`,
      env: { VITE_API_URL: `http://localhost:${API}` },
      url: `http://localhost:${WEB}`,
      timeout: 180_000,
    },
  ],
});
