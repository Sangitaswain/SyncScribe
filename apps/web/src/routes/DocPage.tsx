import { useEffect } from "react";
import { useParams } from "react-router";
import { DOC, docDoc } from "@syncscribe/shared";
import { addRecent, usePrefs } from "../crdt/prefs";
import { useDoc } from "../crdt/hooks";
import MarkdownEditor from "../editor/MarkdownEditor";
import DocTitle from "../editor/DocTitle";

/** Document screen: editor for one doc, opened from the device (works offline). */
export default function DocPage() {
  const { docId } = useParams();
  const { doc: prefs } = usePrefs();
  const doc = useDoc(docId ? docDoc(docId) : undefined);

  useEffect(() => {
    if (prefs && docId) addRecent(prefs, docId);
  }, [prefs, docId]);

  if (!doc) return null;
  return (
    <div className="flex h-full flex-col">
      <DocTitle key={docId} doc={doc} />
      <div className="min-h-0 flex-1">
        <MarkdownEditor key={docId} ytext={doc.getText(DOC.content)} />
      </div>
    </div>
  );
}
