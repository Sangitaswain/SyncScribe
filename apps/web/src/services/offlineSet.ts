import { get, set } from "idb-keyval";
import { useSession } from "../stores/session";
import { setDocStatus } from "../stores/docStatus";

// Documents fully downloaded to this device, kept across reloads (D6 — FP-4.7)

let names = new Set<string>();
const key = () => `${useSession.getState().user?.id ?? "anon"}:offlineSet`;

export async function loadOfflineSet() {
  names = new Set((await get<string[]>(key())) ?? []);
  for (const name of names) setDocStatus(name, { offlineAvailable: true });
}

/** Called once the server has sent everything it has for the doc. */
export function markOffline(name: string) {
  if (names.has(name)) return;
  names.add(name);
  setDocStatus(name, { offlineAvailable: true });
  return set(key(), [...names]);
}
