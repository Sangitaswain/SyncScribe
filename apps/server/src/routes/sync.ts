import { Router } from "express";
import * as Y from "yjs";
import { WS, docDoc, wsDoc } from "@syncscribe/shared";
import { db } from "../db/db";
import { currentUser, requireAuth } from "../auth/middleware";
import { workspacesFor } from "../users";

export const syncRouter = Router();
syncRouter.use(requireAuth);

const stateOf = (name: string) =>
  (db.prepare("SELECT state FROM ydoc_state WHERE name = ?").get(name) as { state: Buffer } | undefined)?.state;

/**
 * First download on a device: every workspace tree the user belongs to plus the documents in it,
 * as base64 Yjs updates. Live sync (Step 10–11) takes over afterwards; Yjs merges both safely.
 */
syncRouter.get("/bootstrap", (_req, res) => {
  const docs: Record<string, string> = {};
  for (const w of workspacesFor(currentUser(res).id)) {
    const state = stateOf(wsDoc(w.id));
    if (!state) continue;
    docs[wsDoc(w.id)] = state.toString("base64");
    const tree = new Y.Doc();
    Y.applyUpdate(tree, state);
    for (const [id, item] of tree.getMap<Y.Map<unknown>>(WS.items)) {
      const docState = item.get("type") === "doc" ? stateOf(docDoc(id)) : undefined;
      if (docState) docs[docDoc(id)] = docState.toString("base64");
    }
  }
  res.json({ docs });
});
