import * as Y from "yjs";
import { nanoid } from "nanoid";
import { CM, DOC } from "@syncscribe/shared";

// Comment threads in cm:{docId}, anchored to text with Yjs relative positions so they stay on their words
// while others edit (F4, FP-4.4). Plain Yjs changes: they work offline and sync like everything else.

export interface Reply {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  mentions: string[];
}

export interface Thread {
  id: string;
  quote: string;
  resolved: boolean;
  createdBy: string;
  createdAt: number;
  replies: Reply[];
}

export interface Author {
  id: string;
  name: string;
}

const threadsOf = (cm: Y.Doc) => cm.getMap<Y.Map<unknown>>(CM.threads);

const reply = (body: string, author: Author, mentions: string[] = []): Reply => ({
  id: nanoid(),
  body: body.trim(),
  authorId: author.id,
  authorName: author.name,
  createdAt: Date.now(),
  mentions,
});

/** Starts a thread on text[from, to] of `doc`; returns its id. */
export function addThread(cm: Y.Doc, doc: Y.Doc, from: number, to: number, body: string, author: Author, mentions: string[] = []) {
  const text = doc.getText(DOC.content);
  const id = nanoid();
  cm.transact(() => {
    const thread = new Y.Map<unknown>();
    threadsOf(cm).set(id, thread);
    thread.set("anchorStart", Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, from)));
    thread.set("anchorEnd", Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, to, -1)));
    thread.set("quote", text.toString().slice(from, to));
    thread.set("resolved", false);
    thread.set("createdBy", author.id);
    thread.set("createdAt", Date.now());
    const replies = new Y.Array<Reply>();
    replies.push([reply(body, author, mentions)]);
    thread.set("replies", replies);
  });
  return id;
}

export function addReply(cm: Y.Doc, threadId: string, body: string, author: Author, mentions: string[] = []) {
  (threadsOf(cm).get(threadId)?.get("replies") as Y.Array<Reply> | undefined)?.push([reply(body, author, mentions)]);
}

export const setResolved = (cm: Y.Doc, threadId: string, resolved: boolean) => threadsOf(cm).get(threadId)?.set("resolved", resolved);

/** Where the thread's text is now; null if that text was deleted. */
export function anchorOf(cm: Y.Doc, doc: Y.Doc, threadId: string) {
  const thread = threadsOf(cm).get(threadId);
  if (!thread) return null;
  const pos = (key: string) =>
    Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(thread.get(key) as Uint8Array), doc)?.index;
  const [from, to] = [pos("anchorStart"), pos("anchorEnd")];
  return from === undefined || to === undefined || to <= from ? null : { from, to };
}

/** All threads, open ones first, newest first. */
export function listThreads(cm: Y.Doc): Thread[] {
  return [...threadsOf(cm).entries()]
    .map(([id, t]) => ({
      id,
      quote: t.get("quote") as string,
      resolved: !!t.get("resolved"),
      createdBy: t.get("createdBy") as string,
      createdAt: t.get("createdAt") as number,
      replies: (t.get("replies") as Y.Array<Reply>).toArray(),
    }))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt);
}
