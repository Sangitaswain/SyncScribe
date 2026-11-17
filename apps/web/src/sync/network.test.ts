// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from "vitest";
import { useNetwork } from "../stores/network";

// The socket and the health check are faked; timers are fake so the 3 s debounce can be stepped through.
const socket = { connect: () => {}, disconnect: () => {} };
const reconnect = vi.fn();
vi.mock("./providers", () => ({
  onConnect: (fn: () => void) => (socket.connect = fn),
  onDisconnect: (fn: () => void) => (socket.disconnect = fn),
  reconnect: (force?: boolean) => reconnect(force),
}));

let serverUp = true;
vi.stubGlobal(
  "fetch",
  vi.fn(async () => {
    if (!serverUp) throw new TypeError("Failed to fetch");
    return new Response("{}");
  }),
);
Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
const state = () => useNetwork.getState().syncState;

beforeAll(async () => {
  vi.useFakeTimers();
  await import("./network");
  socket.connect();
  await vi.advanceTimersByTimeAsync(0);
});

it("is online when the socket is connected and the health check answers", () => {
  expect(state()).toBe("online");
  expect(useNetwork.getState().serverReachable).toBe(true);
});

it("ignores a connection drop shorter than 3 s", async () => {
  socket.disconnect();
  await vi.advanceTimersByTimeAsync(2_000);
  socket.connect();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(state()).toBe("online");
});

it("goes offline 3 s after the server stops, and back online when it returns", async () => {
  serverUp = false;
  socket.disconnect();
  await vi.advanceTimersByTimeAsync(2_900);
  expect(state()).toBe("online");
  await vi.advanceTimersByTimeAsync(200);
  expect(state()).toBe("offline");
  expect(useNetwork.getState().browserOnline).toBe(true); // "Can't reach SyncScribe — working offline"

  // Some pings fail while the server is down, so the server coming back nudges the socket to reconnect
  await vi.advanceTimersByTimeAsync(15_000);
  serverUp = true;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(reconnect).toHaveBeenCalled();
  socket.connect();
  await vi.advanceTimersByTimeAsync(0);
  expect(state()).toBe("online");
});

it("shows syncing while docs are pending or downloading, then synced, and a sync error (E5, EC39)", async () => {
  useNetwork.setState({ pendingCount: 2 });
  expect(state()).toBe("syncing");
  useNetwork.setState({ pendingCount: 0, progress: { done: 1, total: 3 } });
  expect(state()).toBe("syncing");
  useNetwork.setState({ progress: null, lastSyncedAt: Date.now() });
  expect(state()).toBe("synced");
  useNetwork.setState({ errorReason: "The server refused to sync." });
  expect(state()).toBe("error");
});

it("Sync now clears the error and forces a reconnect (E7)", async () => {
  const { syncNow } = await import("./network");
  syncNow();
  expect(state()).toBe("synced");
  expect(reconnect).toHaveBeenLastCalledWith(true);
});

it("treats a browser offline event as offline after the debounce", async () => {
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  window.dispatchEvent(new Event("offline"));
  await vi.advanceTimersByTimeAsync(3_000);
  expect(state()).toBe("offline");
  expect(useNetwork.getState().browserOnline).toBe(false);
});
