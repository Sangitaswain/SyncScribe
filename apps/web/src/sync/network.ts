import { API_URL } from "../services/api";
import { useNetwork } from "../stores/network";
import { onConnect, onDisconnect, reconnect } from "./providers";

// Network Monitor (FP-10.3): SyncScribe counts as reachable only when the browser is online, the sync
// socket is connected and the health check answers (E1, EC3). A loss must last 3 s before the UI
// shows Offline, so a flaky connection does not make the status flicker (EC2).

const PING_EVERY = 15_000;
const PING_TIMEOUT = 5_000;
const OFFLINE_AFTER = 3_000;

let socketUp = false;
let healthy = false;
let offlineTimer: ReturnType<typeof setTimeout> | undefined;

function evaluate() {
  if (navigator.onLine && socketUp && healthy) {
    clearTimeout(offlineTimer);
    offlineTimer = undefined;
    if (!useNetwork.getState().serverReachable) useNetwork.setState({ serverReachable: true, syncState: "online" });
  } else if (useNetwork.getState().serverReachable && !offlineTimer) {
    offlineTimer = setTimeout(() => {
      offlineTimer = undefined;
      useNetwork.setState({ serverReachable: false, syncState: "offline" });
    }, OFFLINE_AFTER);
  }
}

/** Pings `/api/health` (5 s timeout) and re-evaluates; exported for "Sync now" (E7). */
export async function checkHealth() {
  const was = healthy;
  healthy =
    navigator.onLine &&
    (await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(PING_TIMEOUT) }).then(
      (r) => r.ok,
      () => false,
    ));
  if (healthy && !was) reconnect(); // the server is back: don't wait out the socket's retry backoff
  evaluate();
}

window.addEventListener("online", () => {
  useNetwork.setState({ browserOnline: true });
  checkHealth();
});
window.addEventListener("offline", () => {
  useNetwork.setState({ browserOnline: false });
  healthy = false;
  evaluate();
});
onConnect(() => {
  socketUp = true;
  checkHealth();
});
onDisconnect(() => {
  socketUp = false;
  evaluate();
});
setInterval(() => navigator.onLine && checkHealth(), PING_EVERY);
evaluate();
checkHealth();
