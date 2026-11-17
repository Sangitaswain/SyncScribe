// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { addImage, imageProblem } from "./assets";
import MarkdownPreview from "../editor/MarkdownPreview";
import MarkdownEditor from "../editor/MarkdownEditor";
import { toHtml } from "../services/exporter";
import { useStorage } from "../services/storage";

Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
URL.createObjectURL = vi.fn(() => "blob:image");
URL.revokeObjectURL = vi.fn();
const png = (name = "chart.png", size = 3) => new File([new Uint8Array(size).fill(7)], name, { type: "image/png" });

it("explains which images can't be added (EC34, EC25)", () => {
  expect(imageProblem({ name: "notes.pdf", type: "application/pdf", size: 10 })).toBe(
    '"notes.pdf" isn\'t a supported image. Use PNG, JPEG, GIF or WebP.',
  );
  expect(imageProblem({ name: "huge.jpg", type: "image/jpeg", size: 3 * 1024 * 1024 })).toBe(
    '"huge.jpg" is larger than 2 MB. Please use a smaller image.',
  );
  expect(imageProblem(png())).toBeNull();
  useStorage.setState({ warning: "full" });
  expect(imageProblem(png())).toBe("Your device storage is full, so new images can't be added right now.");
  useStorage.setState({ warning: null });
});

it("an image added offline reaches a collaborator after sync and shows in the preview (C10)", async () => {
  const mine = new Y.Doc(); // offline: nothing but this device
  const md = await addImage(mine, png());
  mine.getText(DOC.content).insert(0, `# Results\n\n${md}\n`);

  const theirs = new Y.Doc(); // later, after sync
  Y.applyUpdate(theirs, Y.encodeStateAsUpdate(mine));
  render(<MarkdownPreview ytext={theirs.getText(DOC.content)} />);
  const img = (await screen.findByAltText("chart")) as HTMLImageElement;
  expect(img.src).toBe("blob:image");
  expect(Object.values(theirs.getMap(DOC.assets).toJSON())[0]).toMatchObject({ mime: "image/png", name: "chart.png", size: 3 });

  // Exported HTML carries the image inline, still without scripts or unsafe links
  const html = toHtml("Results", `${theirs.getText(DOC.content).toString()}\n[x](javascript:alert(1))<script>alert(1)</script>`, theirs);
  expect(html).toContain('src="data:image/png;base64,BwcH"');
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("<script>");
});

it("shows a placeholder for an image that isn't on this device (EC38)", async () => {
  cleanup();
  const doc = new Y.Doc();
  doc.getText(DOC.content).insert(0, "![x](asset:missing)");
  render(<MarkdownPreview ytext={doc.getText(DOC.content)} />);
  await screen.findByText("[Image not available on this device]");
});

it("pasting an image stores it in the doc and inserts its markdown", async () => {
  cleanup();
  const doc = new Y.Doc();
  render(<MarkdownEditor ytext={doc.getText(DOC.content)} />);
  const paste = Object.assign(new Event("paste", { bubbles: true, cancelable: true }), { clipboardData: { files: [png("photo.png")], getData: () => "" } });
  document.querySelector(".cm-content")!.dispatchEvent(paste);
  await waitFor(() => expect(doc.getText(DOC.content).toString()).toMatch(/^!\[photo\]\(asset:[\w-]+\)\n$/));
  expect(doc.getMap(DOC.assets).size).toBe(1);
});
