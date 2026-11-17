import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";

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
  find,
}: {
  ytext: Y.Text;
  awareness?: Awareness;
  readOnly?: boolean;
  /** Text to select and scroll to on open, e.g. a search match (4.11) */
  find?: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);

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
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap, indentWithTab]),
          yCollab(ytext, awareness ?? null),
          EditorState.readOnly.of(readOnly), // viewers and commenters (G5)
          EditorView.editable.of(!readOnly),
          theme,
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
  }, [ytext, awareness, readOnly]);

  // Jump to a search match
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !find) return;
    const at = view.state.doc.toString().toLowerCase().indexOf(find.toLowerCase());
    if (at < 0) return;
    view.dispatch({ selection: { anchor: at, head: at + find.length }, scrollIntoView: true });
    view.focus();
  }, [find, ytext]);

  return <div ref={host} className="h-full px-6 dark:[&_.cm-content]:caret-white" />;
}
