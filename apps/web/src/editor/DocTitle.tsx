import type * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { useY } from "../crdt/hooks";
import { setTitle } from "../crdt/tree";

/** Inline document title (C8). Empty titles show as "Untitled" (EC36); new docs start here (4.3 step 2). */
export default function DocTitle({ doc, readOnly = false }: { doc: Y.Doc; readOnly?: boolean }) {
  const meta = useY<{ title?: string }>(doc.getMap(DOC.meta));
  const isNew = !meta?.title && doc.getText(DOC.content).length === 0;
  return (
    <input
      value={meta?.title ?? ""}
      onChange={(e) => setTitle(doc, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (document.querySelector(".cm-content") as HTMLElement | null)?.focus();
      }}
      placeholder="Untitled"
      aria-label="Document title"
      readOnly={readOnly}
      autoFocus={isNew}
      className="mx-auto block w-full max-w-[800px] bg-transparent px-6 pt-14 pb-2 text-[40px] leading-tight font-bold tracking-tight outline-none placeholder:text-black/20 dark:placeholder:text-white/20"
    />
  );
}
