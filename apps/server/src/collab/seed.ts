import * as Y from "yjs";
import { nanoid } from "nanoid";
import { DOC, WS, docDoc, wsDoc } from "@syncscribe/shared";
import { db } from "../db/db";
import { indexTitle, indexWorkspace } from "./treeIndex";

const WELCOME = `# Welcome to SyncScribe

SyncScribe works **with or without an internet connection**.

## How it works
- Everything you type is saved on this device instantly. There is no Save button.
- When you're offline, keep working. Your changes sync automatically when you reconnect.
- The status badge at the top shows: Online, Offline, Syncing, Synced or Sync error.
- If teammates edit the same document, all changes are merged automatically. Nothing is lost.

## Sharing
Use **Share** to invite people as Editor, Commenter or Viewer.

## Important
Clearing your browser data deletes changes that have **not synced yet**. Synced documents come back when you sign in again.
`;

const saveDoc = (name: string, ydoc: Y.Doc) =>
  db
    .prepare("INSERT INTO ydoc_state (name, state, updated_at) VALUES (?, ?, ?)")
    .run(name, Buffer.from(Y.encodeStateAsUpdate(ydoc)), Date.now());

/** Creates the workspace tree doc; for personal workspaces also a Welcome document (BP-6.5). */
export const seedWorkspace = (opts: {
  workspaceId: string;
  userId: string;
  name: string;
  kind: "personal" | "team";
}) => {
  const now = Date.now();
  let welcome: { docId: string; doc: Y.Doc } | undefined;
  const ws = new Y.Doc();
  ws.getMap(WS.info).set("name", opts.name);
  ws.getMap(WS.info).set("kind", opts.kind);

  if (opts.kind === "personal") {
    const docId = nanoid();
    const item = new Y.Map<unknown>();
    ws.getMap(WS.items).set(docId, item);
    for (const [k, v] of Object.entries({
      type: "doc", parentId: null, order: "a0", createdAt: now, createdBy: opts.userId,
      deletedAt: null, deletedBy: null, trashParentId: null,
    })) item.set(k, v);
    item.set("tags", new Y.Array<string>());

    const doc = new Y.Doc();
    doc.getText(DOC.content).insert(0, WELCOME);
    const meta = doc.getMap(DOC.meta);
    meta.set("title", "Welcome to SyncScribe");
    meta.set("createdAt", now);
    meta.set("createdBy", opts.userId);
    meta.set("workspaceId", opts.workspaceId);
    saveDoc(docDoc(docId), doc);
    welcome = { docId, doc };
  }
  saveDoc(wsDoc(opts.workspaceId), ws);
  indexWorkspace(opts.workspaceId, ws);
  if (welcome) indexTitle(welcome.docId, welcome.doc);
};
