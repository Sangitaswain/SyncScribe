import { useMatch } from "react-router";
import { useEditorStats } from "../stores/editorStats";
import { useDocStatus } from "../stores/docStatus";
import { readingMinutes } from "../lib/text";

/** Save/sync state of the open doc, word count and reading time (C6, C12, E6). */
export default function StatusBar() {
  const words = useEditorStats((s) => s.words);
  const docId = useMatch("/doc/:docId")?.params.docId;
  const pending = useDocStatus((s) => !!docId && s[`doc:${docId}`]?.pending);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 px-4 text-[11px] text-muted">
      <span>{pending ? "Saved on this device · waiting to sync" : "Saved on this device"}</span>
      {words !== null && (
        <span className="ml-auto">
          {words} {words === 1 ? "word" : "words"} · {readingMinutes(words)} min read
        </span>
      )}
    </footer>
  );
}
