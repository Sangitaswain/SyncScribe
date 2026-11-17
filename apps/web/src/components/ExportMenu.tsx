import { useState } from "react";
import { Download } from "lucide-react";
import type * as Y from "yjs";
import { docDoc } from "@syncscribe/shared";
import { getDoc, releaseDoc } from "../crdt/registry";
import { exportHtml, exportMarkdown, printPdf } from "../services/exporter";

const OPTIONS: [string, (doc: Y.Doc) => void][] = [
  ["Markdown (.md)", exportMarkdown],
  ["Web page (.html)", exportHtml],
  ["PDF (print)", printPdf],
];

/** Download the open document (J2); works offline. */
export default function ExportMenu({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const run = (fn: (doc: Y.Doc) => void) => async () => {
    setOpen(false);
    const doc = await getDoc(docDoc(docId));
    fn(doc);
    releaseDoc(docDoc(docId));
  };
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Export"
        title="Export"
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
      >
        <Download className="size-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 w-44 rounded-lg border border-line bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#222]">
          {OPTIONS.map(([label, fn]) => (
            <button key={label} onClick={run(fn)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-hover dark:hover:bg-white/5">
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
