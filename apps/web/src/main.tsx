import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { loadSession, refreshIfNeeded } from "./services/session";
import { loadPending } from "./services/pending";
import { offlineSet, revokedSet } from "./services/docSets";
import { loadOutbox } from "./services/outbox";
import { buildIndex } from "./services/search";
import { loadNotifications } from "./services/notifications";
import { startStorage } from "./services/storage";
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

// Check device storage first (EC40), restore the cached session before anything touches the network (A3),
// then refresh the token if needed
startStorage().then(loadSession).then(async () => {
  loadPending();
  await revokedSet.load();
  await offlineSet.load();
  buildIndex(); // offline search over everything on the device (FP-14)
  loadOutbox();
  await refreshIfNeeded();
  loadNotifications();
});
window.addEventListener("online", refreshIfNeeded);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
