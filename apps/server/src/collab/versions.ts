import * as Y from "yjs";
import { nanoid } from "nanoid";
import { db } from "../db/db";

// Automatic version snapshots of documents (BP-6.3, H1)

const INTERVAL = 10 * 60 * 1000;
const authorsSince = new Map<string, Set<string>>(); // who changed each doc since its last version

/** Remembers who changed a doc (called on every change). */
export function noteAuthor(docId: string, userId: string | undefined) {
  if (!userId) return; // server-side changes (jobs) have no author
  if (!authorsSince.has(docId)) authorsSince.set(docId, new Set());
  authorsSince.get(docId)!.add(userId);
}

const exists = db.prepare("SELECT 1 FROM documents WHERE id = ?");
const lastAt = db.prepare("SELECT MAX(created_at) AS at FROM versions WHERE doc_id = ? AND name IS NULL");
const insert = db.prepare("INSERT INTO versions (id, doc_id, state, name, authors, created_at) VALUES (?, ?, ?, ?, ?, ?)");

/** Saves a version of `doc` with the given name and authors; returns its id. */
export function saveVersion(docId: string, doc: Y.Doc, authors: string[], name: string | null = null, now = Date.now()) {
  const id = nanoid();
  insert.run(id, docId, Buffer.from(Y.encodeStateAsUpdate(doc)), name, JSON.stringify(authors), now);
  return id;
}

/**
 * On every store: if something changed, take a version when the last one is over 10 minutes old,
 * or when everyone has left the doc (the end of an editing session, e.g. offline edits just arrived).
 */
export function maybeSnapshot(docId: string, doc: Y.Doc, sessionEnded: boolean, now = Date.now()) {
  const authors = authorsSince.get(docId);
  if (!authors?.size || !exists.get(docId)) return null; // nothing new, or deleted for good
  const last = (lastAt.get(docId) as { at: number | null }).at;
  if (!sessionEnded && last !== null && now - last < INTERVAL) return null;
  authorsSince.delete(docId);
  return saveVersion(docId, doc, [...authors], null, now);
}
