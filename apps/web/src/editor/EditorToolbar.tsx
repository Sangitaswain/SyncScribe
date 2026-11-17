import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Strikethrough,
  Table,
} from "lucide-react";
import { TABLE, insertBlock, insertImages, linePrefix, link, wrap } from "./commands";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";
const alt = isMac ? "⌥" : "Alt+";

const BUTTONS: [string, typeof Bold, (v: EditorView) => boolean, string?][] = [
  ["Bold", Bold, wrap("**"), `${mod}B`],
  ["Italic", Italic, wrap("*"), `${mod}I`],
  ["Strikethrough", Strikethrough, wrap("~~"), `${mod}⇧X`],
  ["Heading 1", Heading1, linePrefix("# "), `${mod}${alt}1`],
  ["Heading 2", Heading2, linePrefix("## "), `${mod}${alt}2`],
  ["Heading 3", Heading3, linePrefix("### "), `${mod}${alt}3`],
  ["Bulleted list", List, linePrefix("- "), `${mod}⇧8`],
  ["Numbered list", ListOrdered, linePrefix("1. "), `${mod}⇧7`],
  ["Task list", ListTodo, linePrefix("- [ ] "), `${mod}⇧9`],
  ["Link", Link, link, `${mod}K`],
  ["Code block", Code, insertBlock("```\n\n```")],
  ["Quote", Quote, linePrefix("> ")],
  ["Table", Table, insertBlock(TABLE)],
  ["Horizontal rule", Minus, insertBlock("---")],
];

const button = "rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white";

/** Markdown formatting for people who don't know the syntax (C4). */
export default function EditorToolbar({ view }: { view: EditorView | null }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="mx-auto flex max-w-[752px] flex-wrap items-center gap-0.5 py-1">
      {BUTTONS.map(([label, Icon, run, keys]) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={keys ? `${label} (${keys})` : label}
          onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
          onClick={() => view && run(view)}
          className={button}
        >
          <Icon className="size-4" />
        </button>
      ))}
      <label className={`${button} cursor-pointer`} title="Image (PNG, JPEG, GIF or WebP, up to 2 MB)">
        <Image className="size-4" />
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="sr-only"
          aria-label="Image"
          onChange={(e) => {
            if (view) insertImages(view, [...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
