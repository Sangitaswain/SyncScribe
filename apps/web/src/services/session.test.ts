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
