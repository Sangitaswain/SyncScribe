import { WS, cmDoc, docDoc, wsDoc } from "@syncscribe/shared";
import { db } from "./db/db";
import { hocuspocus } from "./collab/hocuspocus";

// Permanent deletion (BP-5.4) and the daily clean-up jobs (BP-9, B10)

const DAY = 24 * 60 * 60 * 1000;

/** Deletes docs/folders for good: their state, comments, versions, shares and links; open connections are closed. */
export function deleteDocs(ids: string[]) {
  for (const id of ids) for (const name of [docDoc(id), cmDoc(id)]) hocuspocus.closeConnections(name);
  db.transaction(() => {
    for (const id of ids) {
      db.prepare("DELETE FROM ydoc_state WHERE name IN (?, ?)").run(docDoc(id), cmDoc(id));
      db.prepare("DELETE FROM versions WHERE doc_id = ?").run(id);
      db.prepare("DELETE FROM shares WHERE resource_id = ?").run(id);
      db.prepare("DELETE FROM share_links WHERE resource_id = ?").run(id);
      db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    }
  })();
}

/** Empties items that have been in Trash for 30 days: out of their workspace tree, then out of the database. */
export async function purgeTrash(now = Date.now()) {
  const old = db
    .prepare("SELECT id, workspace_id AS ws FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < ?")
    .all(now - 30 * DAY) as { id: string; ws: string }[];
  for (const ws of new Set(old.map((d) => d.ws))) {
    const conn = await hocuspocus.openDirectConnection(wsDoc(ws));
    await conn.transact((doc) => {
      for (const d of old) if (d.ws === ws) doc.getMap(WS.items).delete(d.id);
    });
    await conn.disconnect();
  }
  deleteDocs(old.map((d) => d.id));
  return old.length;
}

/** Keeps every named version and the newest 200 automatic ones per document (BP-6.3). */
export const pruneVersions = () =>
  db
    .prepare(
      `DELETE FROM versions WHERE id IN (
         SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY doc_id ORDER BY created_at DESC) AS n
                         FROM versions WHERE name IS NULL) WHERE n > 200)`,
    )
    .run().changes;

/** Runs both jobs now and then once a day while the server is up. */
// ponytail: a plain daily timer instead of node-cron; switch if the jobs need a fixed time of day
export function scheduleJobs() {
  const run = () => {
    purgeTrash().catch((e) => console.error("[jobs] trash purge failed", e));
    pruneVersions();
  };
  run();
  return setInterval(run, DAY).unref();
}
