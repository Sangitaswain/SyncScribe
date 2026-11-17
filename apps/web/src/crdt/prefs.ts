import type * as Y from "yjs";
import { USER, userDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { useDoc, useY } from "./hooks";

// Per-user preferences in user:{id}; synced to all of the user's devices (FP-4.5)

export interface Recent {
  docId: string;
  openedAt: number;
}

export interface Settings {
  theme?: "light" | "dark" | "system";
  editorMode?: "edit" | "split" | "preview";
  focusMode?: boolean;
  sort?: "manual" | "name" | "created" | "edited";
  /** The first-run tour was finished or skipped (J4) */
  tourDone?: boolean;
}

const MAX_RECENTS = 20;

export function addRecent(prefs: Y.Doc, docId: string) {
  const recents = prefs.getArray<Recent>(USER.recents);
  prefs.transact(() => {
    const i = recents.toArray().findIndex((r) => r.docId === docId);
    if (i >= 0) recents.delete(i, 1);
    recents.insert(0, [{ docId, openedAt: Date.now() }]);
    if (recents.length > MAX_RECENTS) recents.delete(MAX_RECENTS, recents.length - MAX_RECENTS);
  });
}

export function togglePin(prefs: Y.Doc, itemId: string) {
  const pins = prefs.getArray<string>(USER.pins);
  const i = pins.toArray().indexOf(itemId);
  if (i >= 0) pins.delete(i, 1);
  else pins.push([itemId]);
}

export const setSetting = <K extends keyof Settings>(prefs: Y.Doc, key: K, value: Settings[K]) =>
  prefs.getMap(USER.settings).set(key, value);

/** The signed-in user's preferences, live. */
export function usePrefs() {
  const uid = useSession((s) => s.user?.id);
  const doc = useDoc(uid ? userDoc(uid) : undefined);
  const pins = useY<string[]>(doc?.getArray(USER.pins)) ?? [];
  const recents = useY<Recent[]>(doc?.getArray(USER.recents)) ?? [];
  const settings = useY<Settings>(doc?.getMap(USER.settings)) ?? {};
  return { doc, pins, recents, settings };
}
