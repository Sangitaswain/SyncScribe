import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { loadSession, refreshIfNeeded } from "./services/session";
import { loadPending } from "./services/pending";
import { offlineSet, revokedSet } from "./services/docSets";
import { loadOutbox } from "./services/outbox";
import { useSession } from "./stores/session";
import { reconnect, startSync, stopSync } from "./sync/providers";
import "./sync/background";
import "./sync/network";

// Background sync runs while signed in (FP-10.1); signing out disconnects and closes local docs
useSession.subscribe((s, prev) => {
  if (s.status === "signedIn" && (prev.status !== "signedIn" || s.workspaces !== prev.workspaces)) startSync();
  if (s.status === "signedOut" && prev.status !== "signedOut" && prev.status !== "loading") stopSync();
  if (s.status === "signedIn" && prev.status === "needsReauth") reconnect(true); // sync again with the new token (EC19)
});

// Restore the cached session before anything touches the network (A3), then refresh the token if needed
loadSession().then(async () => {
  loadPending();
  offlineSet.load();
  revokedSet.load();
  loadOutbox();
  await refreshIfNeeded();
});
window.addEventListener("online", refreshIfNeeded);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
