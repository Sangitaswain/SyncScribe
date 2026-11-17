import MiniSearch from "minisearch";
import type * as Y from "yjs";
import { DOC, WS, docDoc, wsDoc } from "@syncscribe/shared";
import { getDoc, onDocChange, releaseDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { offlineSet } from "./docSets";

// Full-text search over every document on this device, in the browser: works offline and
// never sends a query to the server (FP-14, I1, DF14)

interface Entry {
  id: string;
  title: string;
  content: string;
}

export interface SearchResult {
  id: string;
  title: string;
  /** Text around the first match, split so the match can be highlighted */
  snippet: { before: string; match: string; after: string } | null;
}

let index = newIndex();
const texts = new Map<string, Entry>();

function newIndex() {
  return new MiniSearch<Entry>({
    fields: ["title", "content"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
  });
}

/** Adds or refreshes one document in the index. */
export function indexDoc(id: string, doc: Y.Doc) {
  const entry = { id, title: String(doc.getMap(DOC.meta).get("title") ?? ""), content: doc.getText(DOC.content).toString() };
  if (index.has(id)) index.replace(entry);
  else index.add(entry);
  texts.set(id, entry);
}

const BATCH = 20;

/** Indexes every document on the device: those in my workspace trees plus shared ones I downloaded. */
export async function buildIndex() {
  index = newIndex();
  texts.clear();
  const ids = new Set(offlineSet.list().map((n) => n.slice(4)));
  for (const w of useSession.getState().workspaces) {
    const ws = await getDoc(wsDoc(w.id));
    for (const [id, item] of ws.getMap<Y.Map<unknown>>(WS.items)) if (item.get("type") === "doc") ids.add(id);
    releaseDoc(wsDoc(w.id));
  }
  const all = [...ids];
  for (let i = 0; i < all.length; i += BATCH) {
    await Promise.all(
      all.slice(i, i + BATCH).map(async (id) => {
        indexDoc(id, await getDoc(docDoc(id)));
        releaseDoc(docDoc(id));
      }),
    );
    await new Promise((r) => setTimeout(r)); // let the page stay responsive between batches
  }
}

const waiting = new Map<string, { timer: ReturnType<typeof setTimeout>; doc: Y.Doc }>();

// Re-index a document 500 ms after it stops changing (local edits, other tabs or the server)
onDocChange((name, doc) => {
  if (!name.startsWith("doc:")) return;
  clearTimeout(waiting.get(name)?.timer);
  waiting.set(name, { doc, timer: setTimeout(() => indexWaiting(name), 500) });
});

function indexWaiting(name: string) {
  const entry = waiting.get(name);
  if (!entry) return;
  clearTimeout(entry.timer);
  waiting.delete(name);
  indexDoc(name.slice(4), entry.doc);
}

/** Searching right after typing still finds the newest text. */
const catchUp = () => [...waiting.keys()].forEach(indexWaiting);

function snippetOf(content: string, terms: string[]): SearchResult["snippet"] {
  const lower = content.toLowerCase();
  const at = terms
    .map((t) => ({ t, i: lower.indexOf(t.toLowerCase()) }))
    .filter((m) => m.i >= 0)
    .sort((a, b) => a.i - b.i)[0];
  if (!at) return null;
  const start = Math.max(0, at.i - 60);
  return {
    before: (start > 0 ? "…" : "") + content.slice(start, at.i),
    match: content.slice(at.i, at.i + at.t.length),
    after: content.slice(at.i + at.t.length, at.i + at.t.length + 80),
  };
}

/** Quick open (I2): fuzzy match on titles only. */
export const quickOpen = (query: string, keep: (id: string) => boolean = () => true): SearchResult[] =>
  query.trim() && (catchUp(), true)
    ? index
        .search(query, { fields: ["title"], prefix: true, fuzzy: 0.3 })
        .filter((r) => keep(r.id))
        .slice(0, 20)
        .map((r) => ({ id: r.id, title: texts.get(r.id)!.title, snippet: null }))
    : [];

/** Best matches first; `keep` filters out documents that shouldn't show (e.g. in Trash). */
export function search(query: string, keep: (id: string) => boolean = () => true): SearchResult[] {
  if (!query.trim()) return [];
  catchUp();
  return index
    .search(query)
    .filter((r) => keep(r.id))
    .slice(0, 50)
    .map((r) => {
      const entry = texts.get(r.id)!;
      return { id: r.id, title: entry.title, snippet: snippetOf(entry.content, r.terms) };
    });
}
