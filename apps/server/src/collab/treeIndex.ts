import type * as Y from "yjs";
import { DOC, WS, parseDocName } from "@syncscribe/shared";
import { db } from "../db/db";

// Keeps the `documents` table in step with workspace trees, so the server knows which workspace
// (and therefore which members) each document belongs to — including docs created offline (BP-6.4).

const upsert = db.prepare(`
  INSERT INTO documents (id, workspace_id, parent_id, type, owner_id, title, deleted_at, updated_at)
  VALUES (@id, @ws, @parent, @type,
          COALESCE((SELECT id FROM users WHERE id = @owner), (SELECT owner_id FROM workspaces WHERE id = @ws)),
          @title, @deleted, @now)
  ON CONFLICT(id) DO UPDATE SET
    parent_id = excluded.parent_id,
    deleted_at = excluded.deleted_at,
    title = CASE WHEN excluded.type = 'folder' THEN excluded.title ELSE documents.title END,
    updated_at = excluded.updated_at
  -- a doc id already owned by another workspace can't be claimed by putting it in your own tree
  WHERE documents.workspace_id = excluded.workspace_id`);

export function indexWorkspace(workspaceId: string, ws: Y.Doc) {
  if (!db.prepare("SELECT 1 FROM workspaces WHERE id = ?").get(workspaceId)) return; // unknown workspace: ignore
  const now = Date.now();
  db.transaction(() => {
    for (const [id, item] of ws.getMap<Y.Map<unknown>>(WS.items)) {
      const type = item.get("type");
      if (type !== "doc" && type !== "folder") continue;
      upsert.run({
        id,
        ws: workspaceId,
        parent: (item.get("parentId") as string | null) ?? null,
        type,
        owner: String(item.get("createdBy") ?? ""),
        title: type === "folder" ? String(item.get("name") ?? "") : "",
        deleted: (item.get("deletedAt") as number | null) ?? null,
        now,
      });
    }
  })();
}

/** Cached title for "Shared with me" lists and notifications (C8); written only when it changed. */
export const indexTitle = (docId: string, doc: Y.Doc) =>
  db.prepare("UPDATE documents SET title = ?, updated_at = ? WHERE id = ? AND title IS NOT ?").run(
    String(doc.getMap(DOC.meta).get("title") ?? ""), Date.now(), docId, String(doc.getMap(DOC.meta).get("title") ?? ""),
  );

/** Hook used on load and on every change of a workspace/doc. */
export function indexDocument(documentName: string, doc: Y.Doc) {
  const parsed = parseDocName(documentName);
  if (parsed?.kind === "ws") indexWorkspace(parsed.id, doc);
}
