import { useEffect } from "react";
import { useParams } from "react-router";
import { DOC, docDoc } from "@syncscribe/shared";
import { addRecent, setSetting, usePrefs } from "../crdt/prefs";
import { useDoc } from "../crdt/hooks";
import MarkdownEditor from "../editor/MarkdownEditor";
import MarkdownPreview from "../editor/MarkdownPreview";
import DocTitle from "../editor/DocTitle";
import ModeSwitch from "../editor/ModeSwitch";

/** Document screen: title, editor and preview for one doc, opened from the device (works offline). */
export default function DocPage() {
  const { docId } = useParams();
  const { doc: prefs, settings } = usePrefs();
  const doc = useDoc(docId ? docDoc(docId) : undefined);
  const mode = settings.editorMode ?? "edit";

  useEffect(() => {
    if (prefs && docId) addRecent(prefs, docId);
  }, [prefs, docId]);

  if (!doc) return null;
  const ytext = doc.getText(DOC.content);
  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-4 pt-3">
        <ModeSwitch value={mode} onChange={(m) => prefs && setSetting(prefs, "editorMode", m)} />
      </div>
      <DocTitle key={docId} doc={doc} />
      <div className={`grid min-h-0 flex-1 ${mode === "split" ? "grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700" : "grid-cols-1"}`}>
        {mode !== "preview" && <MarkdownEditor key={docId} ytext={ytext} />}
        {mode !== "edit" && <MarkdownPreview ytext={ytext} />}
      </div>
    </div>
  );
}
