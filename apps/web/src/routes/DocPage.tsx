import { useEffect } from "react";
import { useParams } from "react-router";
import { DOC, docDoc } from "@syncscribe/shared";
import { addRecent, usePrefs } from "../crdt/prefs";
import { useDoc, useY } from "../crdt/hooks";
import { useEditorStats } from "../stores/editorStats";
import { countWords } from "../lib/text";
import MarkdownEditor from "../editor/MarkdownEditor";
import MarkdownPreview from "../editor/MarkdownPreview";
import DocTitle from "../editor/DocTitle";

/** Document screen: title, editor and preview for one doc, opened from the device (works offline). */
export default function DocPage() {
  const { docId } = useParams();
  const { doc: prefs, settings } = usePrefs(); // view mode is switched in the page header
  const doc = useDoc(docId ? docDoc(docId) : undefined);
  const mode = settings.editorMode ?? "edit";

  useEffect(() => {
    if (prefs && docId) addRecent(prefs, docId);
  }, [prefs, docId]);

  // Word count for the status bar, updated while typing (C12)
  const text = useY<string>(doc?.getText(DOC.content));
  useEffect(() => {
    if (text === undefined) return;
    const t = setTimeout(() => useEditorStats.setState({ words: countWords(text) }), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => () => useEditorStats.setState({ words: null }), []);

  if (!doc) return null;
  const ytext = doc.getText(DOC.content);
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <DocTitle key={docId} doc={doc} />
      <div className={`grid min-h-0 flex-1 ${mode === "split" ? "grid-cols-2 divide-x divide-line dark:divide-white/10" : "grid-cols-1"}`}>
        {mode !== "preview" && <MarkdownEditor key={docId} ytext={ytext} />}
        {mode !== "edit" && <MarkdownPreview ytext={ytext} />}
      </div>
    </div>
  );
}
