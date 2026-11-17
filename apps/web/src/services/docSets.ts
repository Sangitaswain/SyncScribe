import { get, set } from "idb-keyval";
import { useSession } from "../stores/session";
import { setDocStatus } from "../stores/docStatus";

// Sets of doc names kept across reloads, mirrored into the per-doc status (FP-4.7)

function docSet(suffix: string, field: "offlineAvailable" | "revoked") {
  let names = new Set<string>();
  const key = () => `${useSession.getState().user?.id ?? "anon"}:${suffix}`;
  const save = () => set(key(), [...names]);
  return {
    async load() {
      names = new Set((await get<string[]>(key())) ?? []);
      for (const name of names) setDocStatus(name, { [field]: true });
    },
    add(name: string) {
      if (names.has(name)) return;
      names.add(name);
      setDocStatus(name, { [field]: true });
      return save();
    },
    remove(name: string) {
      if (!names.delete(name)) return;
      setDocStatus(name, { [field]: false });
      return save();
    },
  };
}

/** Docs fully downloaded to this device (D6). */
export const offlineSet = docSet("offlineSet", "offlineAvailable");
/** Docs the user lost access to; their local copy stays until exported or removed (EC16). */
export const revokedSet = docSet("revoked", "revoked");
