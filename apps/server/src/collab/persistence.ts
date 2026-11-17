import { parseDocName } from "@syncscribe/shared";
import { db } from "../db/db";

// Yjs state per document name, stored as one binary blob in SQLite (BP-6.3)

export const fetchState = (name: string): Uint8Array | null => {
  const row = db.prepare("SELECT state FROM ydoc_state WHERE name = ?").get(name) as { state: Buffer } | undefined;
  return row ? new Uint8Array(row.state) : null;
};

const exists = db.prepare("SELECT 1 FROM documents WHERE id = ?");

/** Saves a doc's state; a doc or comment thread that was deleted permanently is never written back. */
export const storeState = (name: string, state: Uint8Array) => {
  const parsed = parseDocName(name);
  if ((parsed?.kind === "doc" || parsed?.kind === "cm") && !exists.get(parsed.id)) return;
  return db
    .prepare(
      `INSERT INTO ydoc_state (name, state, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    )
    .run(name, Buffer.from(state), Date.now());
};
