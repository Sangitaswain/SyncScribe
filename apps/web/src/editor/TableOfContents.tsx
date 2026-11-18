import type { EditorView } from "@codemirror/view";
import type * as Y from "yjs";
import { X } from "lucide-react";
import { useY } from "../crdt/hooks";
import { headingsOf } from "../lib/headings";
import { useUi } from "../stores/ui";

/** The document's headings, updated while typing; clicking one jumps to it (C13). */
export default function TableOfContents({ ytext, view }: { ytext: Y.Text; view: EditorView | null }) {
  const headings = headingsOf(useY<string>(ytext) ?? "");
  const jump = (from: number) => {
    if (!view) return;
    const line = view.state.doc.lineAt(from);
    view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
    view.focus();
  };
  return (
    <aside aria-label="Contents" className="hidden w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-line p-4 md:flex dark:border-white/10">
      <div className="flex items-center">
        <h2 className="flex-1 text-sm font-semibold">Contents</h2>
        <button onClick={() => useUi.setState({ tocOpen: false })} aria-label="Close contents" className="rounded-md p-1 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5">
          <X className="size-4" />
        </button>
      </div>
      {!headings.length && <p className="text-xs text-muted">Headings (# Title) show up here.</p>}
      <nav className="flex flex-col">
        {headings.map((h, i) => (
          <button
            key={`${h.from}-${i}`}
            onClick={() => jump(h.from)}
            className="truncate rounded-md py-1 pr-2 text-left text-[13px] text-ink/80 hover:bg-hover dark:text-white/80 dark:hover:bg-white/5"
            style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </aside>
  );
}
