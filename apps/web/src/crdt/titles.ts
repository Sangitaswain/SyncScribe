import { useEffect } from "react";
import { create } from "zustand";
import { DOC, docDoc } from "@syncscribe/shared";
import { useDoc, useY } from "./hooks";

/** Last known title per doc id, so the tree can sort by name without opening every doc. */
export const useTitles = create<Record<string, string>>(() => ({}));

/** Live title of a document (empty titles display as "Untitled", EC36). */
export function useDocTitle(id: string | undefined) {
  const doc = useDoc(id ? docDoc(id) : undefined);
  const meta = useY<{ title?: string }>(doc?.getMap(DOC.meta));
  const title = meta?.title ?? (id ? useTitles.getState()[id] : "") ?? "";
  useEffect(() => {
    if (id && meta) useTitles.setState({ [id]: meta.title ?? "" });
  }, [id, meta]);
  return title;
}
