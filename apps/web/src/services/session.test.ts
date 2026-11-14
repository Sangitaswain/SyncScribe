import { expect, it } from "vitest";
import type { AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { clearSession, loadSession, saveSession } from "./session";

const auth: AuthResponse = {
  user: { id: "u1", email: "p@example.com", name: "Priya", color: "#e11d48", personalWorkspaceId: "w1" },
  token: "tok",
  workspaces: [{ id: "w1", name: "Priya's workspace", kind: "personal", role: "owner" }],
};

it("saves, restores and clears the session", async () => {
  await saveSession(auth);
  useSession.setState({ user: null, token: null, status: "loading" }); // simulate a reload
  await loadSession();
  expect(useSession.getState()).toMatchObject({ status: "signedIn", token: "tok", activeWorkspaceId: "w1" });

  await clearSession();
  await loadSession();
  expect(useSession.getState()).toMatchObject({ status: "signedOut", user: null });
});

const fakeToken = (expSeconds: number) => `h.${btoa(JSON.stringify({ exp: expSeconds }))}.s`;

it("reads token expiry and asks to sign in when expired", async () => {
  const { tokenExpiry, refreshIfNeeded } = await import("./session");
  expect(tokenExpiry(fakeToken(100))).toBe(100_000);
  expect(tokenExpiry("garbage")).toBe(0);

  await saveSession({ ...auth, token: fakeToken(Date.now() / 1000 - 10) });
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  await refreshIfNeeded();
  expect(useSession.getState().status).toBe("signedIn"); // offline: keep working, ask later

  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  await refreshIfNeeded();
  expect(useSession.getState().status).toBe("needsReauth");
});
