// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DOC, wsDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { createFolder, trash } from "../crdt/tree";
import { exportMarkdown, printPdf, toHtml, workspaceZip } from "./exporter";

// All exports run on the device, with no server (J2, EC38)
useSession.setState({ user: { id: "u9", email: "", name: "", color: "", personalWorkspaceId: "w9" } });

const docWith = (title: string, text: string) => {
  const doc = new Y.Doc();
  doc.getMap(DOC.meta).set("title", title);
  doc.getText(DOC.content).insert(0, text);
  return doc;
};

it("HTML export is a standalone, sanitized page", () => {
  const html = toHtml(`Notes <b>&</b>`, "# Plan\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>");
  expect(html).toContain("<title>Notes &#60;b&#62;&#38;&#60;/b&#62;</title>");
  expect(html).toContain("<h1>Plan</h1>");
  expect(html).toContain("<table>");
  expect(html).not.toContain("<script>");
});

it("Markdown export downloads the text; PDF opens the print view", async () => {
  let saved: Blob | undefined;
  URL.createObjectURL = vi.fn((b: Blob) => ((saved = b), "blob:x"));
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe("Trip - plan.md"); // characters not allowed in file names are replaced
  });
  exportMarkdown(docWith("Trip / plan", "# Day 1"));
  expect(click).toHaveBeenCalled();
  expect(await saved!.text()).toBe("# Day 1");

  printPdf(docWith("Essay", "Some *words*"));
  expect(document.querySelector("iframe")?.srcdoc).toContain("<em>words</em>");
});

it("workspace export keeps the folder structure and leaves Trash out", async () => {
  const ws = await getDoc(wsDoc("w9"));
  const folder = createFolder(ws, null, "Week 1", "u9");
  await newDocument("w9", folder, "intro", "Lecture");
  await newDocument("w9", folder, "again", "Lecture");
  await newDocument("w9", null, "top", "Readme");
  trash(ws, await newDocument("w9", null, "gone", "Old"), "u9");

  const zip = await workspaceZip("w9");
  const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir).sort();
  expect(files).toEqual(["Readme.md", "Week 1/Lecture (2).md", "Week 1/Lecture.md"]);
  expect(await zip.file("Readme.md")!.async("string")).toBe("top");
});
