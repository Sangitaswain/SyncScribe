// Single source of truth for Yjs document names and field keys (FRONTEND_PLAN.md FP-4).

export const wsDoc = (workspaceId: string) => `ws:${workspaceId}`;
export const docDoc = (docId: string) => `doc:${docId}`;
export const cmDoc = (docId: string) => `cm:${docId}`;
export const userDoc = (userId: string) => `user:${userId}`;

export type DocKind = "ws" | "doc" | "cm" | "user";

/** Splits "doc:abc" into { kind: "doc", id: "abc" }; returns null for unknown names. */
export const parseDocName = (name: string): { kind: DocKind; id: string } | null => {
  const m = /^(ws|doc|cm|user):(.+)$/.exec(name);
  return m ? { kind: m[1] as DocKind, id: m[2] } : null;
};

/** ws:{id} — workspace tree */
export const WS = { items: "items", templates: "templates", info: "info" } as const;

/** doc:{id} — one document */
export const DOC = { content: "content", meta: "meta", assets: "assets" } as const;

/** cm:{id} — comments */
export const CM = { threads: "threads" } as const;

/** user:{id} — per-user preferences */
export const USER = { pins: "pins", recents: "recents", settings: "settings" } as const;
