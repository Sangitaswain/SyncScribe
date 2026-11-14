import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { useSession } from "../stores/session";

const reply = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
  useSession.setState({ token: null, status: "signedOut" });
});

it("returns JSON and sends the bearer token", async () => {
  useSession.setState({ token: "t1" });
  const spy = reply(200, { ok: true });
  expect(await api("/health")).toEqual({ ok: true });
  expect(spy.mock.calls[0][0]).toBe("http://localhost:4000/api/health");
  expect((spy.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBe("Bearer t1");
});

it("throws typed errors and flags expired sessions", async () => {
  useSession.setState({ token: "old", status: "signedIn" });
  reply(401, { error: { code: "token-expired", message: "Your session has expired" } });
  await expect(api("/me")).rejects.toMatchObject({ status: 401, code: "token-expired" });
  expect(useSession.getState().status).toBe("needsReauth");
});

it("turns network failures into an offline error", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
  const err = (await api("/health").catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.code).toBe("offline");
});
