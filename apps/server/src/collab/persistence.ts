import { db } from "../db/db";

// Yjs state per document name, stored as one binary blob in SQLite (BP-6.3)

export const fetchState = (name: string): Uint8Array | null => {
  const row = db.prepare("SELECT state FROM ydoc_state WHERE name = ?").get(name) as { state: Buffer } | undefined;
  return row ? new Uint8Array(row.state) : null;
};

export const storeState = (name: string, state: Uint8Array) =>
  db
    .prepare(
      `INSERT INTO ydoc_state (name, state, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    )
    .run(name, Buffer.from(state), Date.now());
