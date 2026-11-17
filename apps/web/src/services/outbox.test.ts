import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { AuthResponse } from "@syncscribe/shared";

// Against the real server: actions queued while offline are sent once it is reachable again (FP-13).
vi.stubEnv("DB_PATH", ":memory:");
Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

let server: Awaited<ReturnType<typeof import("../../../server/src/test/collabServer").startServer>>;
let me: AuthResponse;
let docId = "";

beforeAll(async () => {
  const helpers = await import("../../../server/src/test/collabServer");
  server = await helpers.startServer();
  vi.stubEnv("VITE_API_URL", `http://localhost:${server.port}`);
  const signup = (name: string) =>
    fetch(`http://localhost:${server.port}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email: `${name}@example.com`, password: "password123" }),
    }).then((r) => r.json());
  me = await signup("owner");
  await signup("friend");
  const { saveSession } = await import("./session");
  await saveSession(me);
  const { api } = await import("./api");
  docId = (await api<{ names: string[] }>("/sync/all")).names.find((n) => n.startsWith("doc:"))!.slice(4);
});
afterAll(() => server.close());

it("sends an invite made offline after reconnecting, drops refused actions with a message, keeps failed ones", async () => {
  const { useNetwork } = await import("../stores/network");
  const { useUi } = await import("../stores/ui");
  const { api } = await import("./api");
  const { sendOrQueue, flush, outboxItems, loadOutbox } = await import("./outbox");
  const shares = () => api<{ shares: { email: string }[] }>(`/shares?resource=${docId}`).then((r) => r.shares.map((s) => s.email));

  // Offline: both actions wait on the device, even across a reload
  useNetwork.setState({ serverReachable: false });
  const invite = { resourceId: docId, email: "friend@example.com", role: "editor" };
  expect(await sendOrQueue("Invite to friend@example.com", "POST", "/shares", invite)).toBeNull();
  await sendOrQueue("Invite to me", "POST", "/shares", { ...invite, email: "owner@example.com" }); // the server will refuse
  await sendOrQueue("Invite to later@example.com", "POST", "/shares", { ...invite, email: "later@example.com" });
  await loadOutbox();
  expect(outboxItems().map((i) => i.label)).toEqual(["Invite to friend@example.com", "Invite to me", "Invite to later@example.com"]);
  expect(await shares()).toEqual([]);

  // A network failure keeps everything queued
  const fetchOnce = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
  useNetwork.setState({ serverReachable: true }); // reconnect → flush
  await vi.waitFor(() => expect(fetchOnce).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50)); // let that attempt finish
  expect(outboxItems()).toHaveLength(3);
  fetchOnce.mockRestore();

  await flush();
  expect(outboxItems()).toEqual([]);
  expect(await shares()).toEqual(["friend@example.com", "later@example.com"]);
  expect(useUi.getState().toasts.map((t) => t.message)).toContain("Invite to me failed: You already have access");

  // Online: calls go straight through
  expect(await sendOrQueue("Invite again", "POST", "/shares", { ...invite, role: "viewer" })).toMatchObject({ role: "viewer" });
});
