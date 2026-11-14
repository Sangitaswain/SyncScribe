import { docDoc, wsDoc } from "@syncscribe/shared";
import { getDoc, releaseDoc } from "./registry";
import { copyDoc, createDocItem, initDoc, readItem } from "./tree";
import { useSession } from "../stores/session";

// Higher-level actions that touch both the workspace tree and a document doc.

const userId = () => useSession.getState().user!.id;

/** Creates a document in the tree and its doc:{id}; returns the new id (C1). */
export async function newDocument(workspaceId: string, parentId: string | null, content?: string, title = "") {
  const ws = await getDoc(wsDoc(workspaceId));
  const id = createDocItem(ws, parentId, userId());
  const doc = await getDoc(docDoc(id));
  initDoc(doc, { title, workspaceId, userId: userId(), content });
  releaseDoc(docDoc(id));
  releaseDoc(wsDoc(workspaceId));
  return id;
}

/** Duplicates a document next to the original (C9). */
export async function duplicateDocument(workspaceId: string, sourceId: string) {
  const ws = await getDoc(wsDoc(workspaceId));
  const parentId = readItem(ws, sourceId)?.parentId ?? null;
  const id = createDocItem(ws, parentId, userId());
  const [src, dst] = await Promise.all([getDoc(docDoc(sourceId)), getDoc(docDoc(id))]);
  copyDoc(src, dst);
  releaseDoc(docDoc(sourceId));
  releaseDoc(docDoc(id));
  releaseDoc(wsDoc(workspaceId));
  return id;
}
