import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { loadSession, refreshIfNeeded } from "./services/session";

// Restore the cached session before anything touches the network (A3), then refresh the token if needed
loadSession().then(refreshIfNeeded);
window.addEventListener("online", refreshIfNeeded);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
