// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { replaceAll, setSearchQuery, SearchQuery, searchPanelOpen } from "@codemirror/search";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import MarkdownEditor from "./MarkdownEditor";
import { useUi } from "../stores/ui";

Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

let ytext: Y.Text;
let view: EditorView;
function open(text: string) {
  cleanup();
  ytext = new Y.Doc().getText(DOC.content);
  ytext.insert(0, text);
  render(<MarkdownEditor ytext={ytext} />);
  view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
}
const select = (from: number, to = from) => view.dispatch({ selection: { anchor: from, head: to } });
const key = (k: string, mods: { shift?: boolean; alt?: boolean } = {}) =>
  runScopeHandlers(
    view,
    new KeyboardEvent("keydown", { key: k, ctrlKey: true, shiftKey: !!mods.shift, altKey: !!mods.alt }), // "Mod" is Ctrl off a Mac
    "editor",
  );

beforeEach(() => useUi.setState({ toasts: [] }));

it("toolbar buttons format the selection as normal CRDT edits (C4, FP-9.2)", () => {
  open("word\nline");
  const click = (label: string) => fireEvent.click(screen.getByLabelText(label));
  select(0, 4);
  click("Bold");
  expect(ytext.toString()).toBe("**word**\nline");
  select(9, 13);
  click("Heading 2");
  expect(ytext.toString()).toBe("**word**\n## line");
  click("Heading 3"); // replaces the heading level
  expect(ytext.toString()).toBe("**word**\n### line");
  click("Numbered list");
  expect(ytext.toString()).toBe("**word**\n1. line");
  click("Numbered list"); // again: removed
  expect(ytext.toString()).toBe("**word**\nline");

  for (const [label, expected] of [
    ["Italic", "*"],
    ["Strikethrough", "~~"],
  ]) {
    open("x");
    select(0, 1);
    click(label);
    expect(ytext.toString()).toBe(`${expected}x${expected}`);
  }
  for (const [label, expected] of [
    ["Heading 1", "# x"],
    ["Bulleted list", "- x"],
    ["Task list", "- [ ] x"],
    ["Quote", "> x"],
  ]) {
    open("x");
    select(0);
    click(label);
    expect(ytext.toString()).toBe(expected);
  }
  open("see docs");
  select(4, 8);
  click("Link");
  expect(ytext.toString()).toBe("see [docs](https://)");
  for (const [label, expected] of [
    ["Code block", "```\n\n```\n"],
    ["Table", "| Column | Column |\n| --- | --- |\n| | |\n"],
    ["Horizontal rule", "---\n"],
  ]) {
    open("");
    click(label);
    expect(ytext.toString()).toBe(expected);
  }
  expect(screen.getByLabelText("Image")).toBeTruthy(); // upload, covered by the image tests
});

it("keyboard shortcuts do the same (C5)", () => {
  const cases: [string, { shift?: boolean; alt?: boolean }, string][] = [
    ["b", {}, "**x**"],
    ["i", {}, "*x*"],
    ["x", { shift: true }, "~~x~~"],
    ["1", { alt: true }, "# x"],
    ["2", { alt: true }, "## x"],
    ["3", { alt: true }, "### x"],
    ["8", { shift: true }, "- x"],
    ["7", { shift: true }, "1. x"],
    ["9", { shift: true }, "- [ ] x"],
    ["k", {}, "[x](https://)"],
  ];
  for (const [k, mods, expected] of cases) {
    open("x");
    select(0, 1);
    expect(key(k, mods)).toBe(true);
    expect(ytext.toString()).toBe(expected);
  }
});

it("finds and replaces in the document (C11)", () => {
  open("cat and cat");
  key("f");
  expect(searchPanelOpen(view.state)).toBe(true);
  view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "cat", replace: "dog" })) });
  replaceAll(view);
  expect(ytext.toString()).toBe("dog and dog");
});

it("refuses a paste over 1 MB and says why (EC32)", () => {
  open("keep");
  const paste = Object.assign(new Event("paste", { bubbles: true, cancelable: true }), {
    clipboardData: { files: [], getData: () => "a".repeat(1_000_001) },
  });
  document.querySelector(".cm-content")!.dispatchEvent(paste);
  expect(ytext.toString()).toBe("keep");
  expect(useUi.getState().toasts.map((t) => t.message)).toContain("Paste is larger than the 1 MB limit");
});
