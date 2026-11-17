// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatSize, startStorage, useStorage, WARNINGS } from "./storage";
import StorageBanner from "../components/StorageBanner";
import { getDoc, setSaveOnDevice } from "../crdt/registry";
import { pendingNames } from "./pending";
import { useSession } from "../stores/session";

const MB = 1024 * 1024;
const fakeStorage = (usage: number, quota: number, persisted = true) =>
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { estimate: async () => ({ usage, quota }), persist: async () => persisted },
  });

beforeEach(() => {
  cleanup();
  useStorage.setState({ usage: null, quota: null, warning: null });
});

it("warns when storage is nearly full, and shows usage (D7, EC24)", async () => {
  fakeStorage(900 * MB, 1000 * MB);
  await startStorage();
  expect(useStorage.getState()).toMatchObject({ usage: 900 * MB, quota: 1000 * MB, warning: "nearlyFull" });
  render(<StorageBanner />);
  expect(screen.getByRole("alert").textContent).toBe(WARNINGS.nearlyFull);
  expect(formatSize(900 * MB)).toBe("900 MB");
  expect(formatSize(1.5 * 1024 * MB)).toBe("1.5 GB");
});

it("warns in a private window (EC27)", async () => {
  fakeStorage(1 * MB, 100 * MB, false);
  await startStorage();
  expect(useStorage.getState().warning).toBe("private");
});

it("says so when the device is full (EC25)", () => {
  const event = Object.assign(new Event("unhandledrejection"), { reason: Object.assign(new Error("full"), { name: "QuotaExceededError" }) });
  window.dispatchEvent(event);
  expect(useStorage.getState().warning).toBe("full");
});

it("runs online-only when IndexedDB is blocked, and still tracks edits (EC40)", async () => {
  const real = indexedDB;
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: {
      open: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    },
  });
  await startStorage();
  Object.defineProperty(window, "indexedDB", { configurable: true, value: real });
  expect(useStorage.getState().warning).toBe("unavailable");

  useSession.setState({ user: { id: "u10", email: "", name: "", color: "", personalWorkspaceId: "w10" } });
  const doc = await getDoc("doc:memory-only"); // opens at once, nothing read from the device
  doc.getText("content").insert(0, "still works");
  await new Promise((r) => setTimeout(r, 10));
  expect(pendingNames()).toContain("doc:memory-only");
  setSaveOnDevice(true);
});
