import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router";
import { DOC, docDoc, rank } from "@syncscribe/shared";
import { addRecent, usePrefs } from "../crdt/prefs";
import { useDoc, useY } from "../crdt/hooks";
import { awarenessOf } from "../crdt/registry";
import { useEditorStats } from "../stores/editorStats";
import { usePresence, type PresenceUser } from "../stores/presence";
import { useDocStatus } from "../stores/docStatus";
import { countWords } from "../lib/text";
import MarkdownEditor from "../editor/MarkdownEditor";
import AccessBanner from "../editor/AccessBanner";
import DocDeletedBanner from "../editor/DocDeletedBanner";
import MarkdownPreview from "../editor/MarkdownPreview";
import DocTitle from "../editor/DocTitle";
import { syncWhileOpen } from "../sync/providers";

/** Document screen: title, editor and preview for one doc, opened from the device (works offline). */
export default function DocPage() {
  const { docId } = useParams();
  const [params] = useSearchParams();
  const { doc: prefs, settings } = usePrefs(); // view mode is switched in the page header
  const doc = useDoc(docId ? docDoc(docId) : undefined);
  const mode = settings.editorMode ?? "edit";

  useEffect(() => {
    if (prefs && docId) addRecent(prefs, docId);
  }, [prefs, docId]);

  // Live sync with the server while the doc is open (E2)
  useEffect(() => {
    if (docId) return syncWhileOpen(docDoc(docId));
  }, [docId]);

  // Who has this doc open, one avatar per person even with several tabs (F2)
  useEffect(() => {
    const awareness = doc && docId ? awarenessOf(docDoc(docId)) : undefined;
    if (!awareness) return;
    const publish = () => {
      const users = new Map<string, PresenceUser>();
      for (const s of awareness.getStates().values()) if (s.user) users.set(s.user.id, s.user);
      usePresence.setState({ users: [...users.values()] });
    };
    publish();
    awareness.on("change", publish);
    return () => {
      awareness.off("change", publish);
      usePresence.setState({ users: [] });
    };
  }, [doc, docId]);

  // Word count for the status bar, updated while typing (C12)
  const text = useY<string>(doc?.getText(DOC.content));
  useEffect(() => {
    if (text === undefined) return;
    const t = setTimeout(() => useEditorStats.setState({ words: countWords(text) }), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => () => useEditorStats.setState({ words: null }), []);

  // Viewers, commenters and people whose access was removed can't edit (G5, EC16)
  const readOnly = useDocStatus((s) => {
    const status = docId ? s[docDoc(docId)] : undefined;
    return !!status && (status.revoked || rank(status.role) < rank("editor"));
  });

  if (!doc) return null;
  const ytext = doc.getText(DOC.content);
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AccessBanner docId={docId!} doc={doc} />
      <DocDeletedBanner docId={docId!} />
      <DocTitle key={docId} doc={doc} readOnly={readOnly} />
      <div className={`grid min-h-0 flex-1 ${mode === "split" ? "grid-cols-2 divide-x divide-line dark:divide-white/10" : "grid-cols-1"}`}>
        {mode !== "preview" && <MarkdownEditor key={docId} ytext={ytext} awareness={awarenessOf(docDoc(docId!))} readOnly={readOnly} find={params.get("find")} />}
        {mode !== "edit" && <MarkdownPreview ytext={ytext} />}
      </div>
    </div>
  );
}
