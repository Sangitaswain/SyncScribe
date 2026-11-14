import { get, set } from "idb-keyval";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { setDocStatus } from "../stores/docStatus";
import { toast } from "../stores/ui";

// Docs with local changes not yet confirmed by the server, kept across reloads (D4, E6 — FP-4.7)

type Pending = Record<string, { since: number }>;
let pending: Pending = {};

const key = () => `${useSession.getState().user?.id ?? "anon"}:pending`;
const publish = () => useNetwork.setState({ pendingCount: Object.keys(pending).length });
const save = () => set(key(), pending);

export async function loadPending() {
  pending = (await get<Pending>(key())) ?? {};
  for (const name of Object.keys(pending)) setDocStatus(name, { pending: true });
  publish();
}

export function markPending(name: string) {
  if (pending[name]) return;
  pending = { ...pending, [name]: { since: Date.now() } };
  setDocStatus(name, { pending: true, synced: false });
  publish();
  return save();
}

/** A change that waited this long was made offline (or the server was slow), so it's worth announcing. */
const WAITED = 5000;

export function clearPending(name: string) {
  if (!pending[name]) return;
  const { [name]: cleared, ...rest } = pending;
  pending = rest;
  setDocStatus(name, { pending: false, synced: true });
  publish();
  // Normal online typing confirms within a second; only announce catching up after a wait (4.4 step 7)
  if (!Object.keys(pending).length && Date.now() - cleared.since > WAITED) toast("All changes synced", "success");
  return save();
}

export const pendingNames = () => Object.keys(pending);
