import { EditorSelection } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type * as Y from "yjs";
import { addImage, imageProblem } from "../crdt/assets";
import { toast } from "../stores/ui";

// Formatting commands (C4, C5). Each one is an ordinary editor change, so it syncs and undoes like typing.

/** Puts `before`/`after` around each selection; with nothing selected, places the cursor between them. */
export const wrap = (before: string, after = before) => (view: EditorView) => {
  view.dispatch(
    view.state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: before },
        { from: range.to, insert: after },
      ],
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    })),
  );
  view.focus();
  return true;
};

const PREFIX = /^(#{1,6} |[-*] \[[ x]\] |[-*] |\d+\. |> )/;

/** Gives every selected line `prefix` (replacing another heading/list/quote prefix), or removes it if all have it. */
export const linePrefix = (prefix: string) => (view: EditorView) => {
  const { state } = view;
  const lines = new Map<number, { from: number; text: string }>();
  for (const r of state.selection.ranges)
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) {
      const line = state.doc.line(n);
      lines.set(n, { from: line.from, text: line.text });
    }
  const all = [...lines.values()];
  const remove = all.every((l) => l.text.startsWith(prefix));
  view.dispatch({
    changes: all.map(({ from, text }, i) => {
      const old = text.match(PREFIX)?.[0] ?? "";
      const next = remove ? "" : prefix === "1. " ? `${i + 1}. ` : prefix;
      return { from, to: from + old.length, insert: next };
    }),
  });
  view.focus();
  return true;
};

/** Inserts a block of markdown on its own lines at the cursor. */
export const insertBlock = (text: string) => (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lead = from === line.from ? "" : "\n";
  view.dispatch({ changes: { from, to, insert: `${lead}${text}\n` }, selection: { anchor: from + lead.length + text.length + 1 } });
  view.focus();
  return true;
};

/** `[selected text](https://)` with the URL selected, ready to type over. */
export const link = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const label = view.state.sliceDoc(from, to) || "link text";
  const url = "https://";
  const insert = `[${label}](${url})`;
  const start = from + label.length + 3;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: start, head: start + url.length } });
  view.focus();
  return true;
};

export const TABLE = "| Column | Column |\n| --- | --- |\n| | |";

export const formattingKeymap: KeyBinding[] = [
  { key: "Mod-b", run: wrap("**") },
  { key: "Mod-i", run: wrap("*") },
  { key: "Mod-Shift-x", run: wrap("~~") },
  { key: "Mod-Alt-1", run: linePrefix("# ") },
  { key: "Mod-Alt-2", run: linePrefix("## ") },
  { key: "Mod-Alt-3", run: linePrefix("### ") },
  { key: "Mod-Shift-8", run: linePrefix("- ") },
  { key: "Mod-Shift-7", run: linePrefix("1. ") },
  { key: "Mod-Shift-9", run: linePrefix("- [ ] ") },
  { key: "Mod-k", run: link },
];

const docs = new WeakMap<EditorView, Y.Doc>();
const docOf = (view: EditorView) => docs.get(view);
/** Lets the image commands find the Y.Doc an editor belongs to. */
export const rememberDoc = (view: EditorView, doc: Y.Doc) => docs.set(view, doc);

/**
 * Adds image files to the doc and inserts their markdown at `pos` (default: the cursor). Returns false if
 * there were no images, so the editor handles the paste or drop as usual (C10, EC34).
 */
export function insertImages(view: EditorView, files: File[], pos?: number) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  const doc = images.length ? docOf(view) : undefined;
  if (!doc) return false;
  (async () => {
    let at = pos ?? view.state.selection.main.head;
    for (const file of images) {
      const problem = imageProblem(file);
      if (problem) {
        toast(problem, "error");
        continue;
      }
      const md = `${await addImage(doc, file)}\n`;
      view.dispatch({ changes: { from: at, insert: md }, selection: { anchor: at + md.length } });
      at += md.length;
    }
  })();
  return true;
}


/** Text pastes over 1 MB are refused with a message (EC32). */
export const LARGE_PASTE = 1_000_000;
export function pasteTooLarge(text: string) {
  if (text.length <= LARGE_PASTE) return false;
  toast("Paste is larger than the 1 MB limit", "error");
  return true;
}
