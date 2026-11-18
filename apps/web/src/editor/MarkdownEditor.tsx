import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { formattingKeymap, insertImages, pasteTooLarge, rememberDoc } from "./commands";
import EditorToolbar from "./EditorToolbar";

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "16px" },
  ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.75" },
  ".cm-content": { padding: "8px 0 96px", maxWidth: "752px", margin: "0 auto" },
  ".cm-placeholder": { color: "rgb(0 0 0 / 0.25)" },
  "&.cm-focused": { outline: "none" },
});


/**
 * CodeMirror bound to the document's Y.Text: every keystroke is a CRDT change saved on the device (C2, C6).
 * Collaborators' cursors and selections show with their name and colour (F1, F3).
 */
export default function MarkdownEditor({
  ytext,
  awareness,
  readOnly = false,
  selectable = false,
  find,
  onView,
}: {
  ytext: Y.Text;
  awareness?: Awareness;
  readOnly?: boolean;
  /** Read-only but text can still be selected, e.g. to comment on it */
  selectable?: boolean;
  /** Called with the editor once it exists (the comments panel uses its selection) */
  onView?: (view: EditorView | null) => void;
  /** Text to select and scroll to on open, e.g. a search match (4.11) */
  find?: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [
          markdown({ base: markdownLanguage }), // GitHub-flavoured: tables, task lists, strikethrough
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          drawSelection(),
          placeholder("Start writing in markdown…"),
          // Undo/redo only this user's edits, never a collaborator's (C7, EC14)
          // Formatting shortcuts (C5) and find & replace in the doc (C11)
          keymap.of([...formattingKeymap, { key: "Mod-Alt-f", run: openSearchPanel }, ...searchKeymap]),
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap, indentWithTab]),
          search({ top: true }),
          yCollab(ytext, awareness ?? null),
          EditorState.readOnly.of(readOnly), // viewers and commenters (G5)
          EditorView.domEventHandlers({
            paste: (e, view) =>
              !readOnly && (pasteTooLarge(e.clipboardData?.getData("text/plain") ?? "") || insertImages(view, [...(e.clipboardData?.files ?? [])])),
            drop: (e, view) =>
              !readOnly && insertImages(view, [...(e.dataTransfer?.files ?? [])], view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? undefined),
          }),
          EditorView.editable.of(!readOnly || selectable),
          theme,
        ],
      }),
    });
    viewRef.current = view;
    setView(view);
    onView?.(view);
    if (ytext.doc) rememberDoc(view, ytext.doc);
    return () => {
      onView?.(null);
      view.destroy();
    };
  }, [ytext, awareness, readOnly, selectable]);

  // Jump to a search match
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !find) return;
    const at = view.state.doc.toString().toLowerCase().indexOf(find.toLowerCase());
    if (at < 0) return;
    view.dispatch({ selection: { anchor: at, head: at + find.length }, scrollIntoView: true });
    view.focus();
  }, [find, ytext]);

  return (
    <div className="flex h-full flex-col">
      {!readOnly && (
        <div className="px-6">
          <EditorToolbar view={view} />
        </div>
      )}
      <div ref={host} className="min-h-0 flex-1 px-6 dark:[&_.cm-content]:caret-white" />
    </div>
  );
}
