import { configDefaults, defineConfig } from "vitest/config";

// fake-indexeddb gives tests a working IndexedDB in Node; e2e/ is run by Playwright, not Vitest
export default defineConfig({ test: { setupFiles: ["fake-indexeddb/auto"], exclude: [...configDefaults.exclude, "e2e/**"] } });
