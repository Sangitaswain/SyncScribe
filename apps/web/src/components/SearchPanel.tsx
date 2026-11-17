import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FileText, Search } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import type { TreeItem } from "../crdt/tree";
import { quickOpen, search, type SearchResult } from "../services/search";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";

/**
 * Search (I1, 4.11) or quick open by title (I2). Everything runs on this device, so it works offline.
 * Opening a result jumps to the match.
 */
export function SearchPanel({ titlesOnly = false }: { titlesOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const workspaceId = useSession((s) => s.activeWorkspaceId);
  const ws = useDoc(workspaceId ? wsDoc(workspaceId) : undefined);
  const items = useY<Record<string, TreeItem>>(ws?.getMap(WS.items)) ?? {};
  const keep = (id: string) => !items[id]?.deletedAt; // nothing from Trash
  const results: SearchResult[] = titlesOnly ? quickOpen(query, keep) : search(query, keep);

  const open = (r: SearchResult) => {
    useUi.setState({ modal: null });
    navigate(`/doc/${r.id}${r.snippet ? `?find=${encodeURIComponent(r.snippet.match)}` : ""}`);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 dark:border-white/10">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && results[active]) open(results[active]);
          }}
          placeholder={titlesOnly ? "Open a document by title…" : "Search all documents…"}
          aria-label={titlesOnly ? "Quick open" : "Search"}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none"
        />
      </div>
      <ul className="max-h-[60vh] overflow-y-auto p-1" role="listbox">
        {query.trim() && !results.length && <li className="px-3 py-6 text-center text-sm text-muted">No matches on this device.</li>}
        {results.map((r, i) => (
          <li key={r.id} role="option" aria-selected={i === active}>
            <button
              onClick={() => open(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full gap-2 rounded-md px-3 py-2 text-left ${i === active ? "bg-active dark:bg-white/10" : ""}`}
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{r.title || "Untitled"}</span>
                {r.snippet && (
                  <span className="block truncate text-[12px] text-muted">
                    {r.snippet.before}
                    <mark className="rounded-sm bg-brand/20 text-ink dark:text-white">{r.snippet.match}</mark>
                    {r.snippet.after}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cmd/Ctrl+K or Cmd/Ctrl+Shift+F opens search, Cmd/Ctrl+P quick open; Escape closes (C5). */
export default function SearchOverlay() {
  const modal = useUi((s) => s.modal);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const inEditor = (e.target as Element | null)?.closest?.(".cm-editor"); // there Cmd+K makes a link
      const search = mod && ((e.key === "k" && !inEditor) || (e.shiftKey && e.code === "KeyF"));
      if (search || (mod && e.key === "p")) {
        e.preventDefault(); // Cmd+P would print
        useUi.setState({ modal: search ? "search" : "quickopen" });
      } else if (e.key === "Escape" && (useUi.getState().modal === "search" || useUi.getState().modal === "quickopen"))
        useUi.setState({ modal: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (modal !== "search" && modal !== "quickopen") return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => useUi.setState({ modal: null })}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search documents" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1c1c1c]">
        <SearchPanel key={modal} titlesOnly={modal === "quickopen"} />
      </div>
    </div>
  );
}
