import { defineConfig } from "vitest/config";

// fake-indexeddb gives tests a working IndexedDB in Node
export default defineConfig({ test: { setupFiles: ["fake-indexeddb/auto"] } });
