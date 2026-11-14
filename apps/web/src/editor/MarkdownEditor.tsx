import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type * as Y from "yjs";

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "15px" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: "1.6" },
  ".cm-content": { padding: "24px 0", maxWidth: "760px", margin: "0 auto" },
  "&.cm-focused": { outline: "none" },
});

/** CodeMirror bound to the document's Y.Text: every keystroke is a CRDT change saved on the device (C2, C6). */
export default function MarkdownEditor({ ytext }: { ytext: Y.Text }) {
  const host = useRef<HTMLDivElement>(null);

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
          yCollab(ytext, null),
          theme,
        ],
      }),
    });
    return () => view.destroy();
  }, [ytext]);

  return <div ref={host} className="h-full px-6 dark:[&_.cm-content]:caret-white" />;
}
