// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import DocTitle from "./DocTitle";

it("edits the title in the document and shows Untitled when empty", () => {
  const doc = new Y.Doc();
  render(<DocTitle doc={doc} />);
  const input = screen.getByLabelText("Document title") as HTMLInputElement;
  expect(input.placeholder).toBe("Untitled");
  expect(document.activeElement).toBe(input); // new doc: cursor starts in the title

  fireEvent.change(input, { target: { value: "Group report" } });
  expect(doc.getMap(DOC.meta).get("title")).toBe("Group report");

  act(() => doc.getMap(DOC.meta).set("title", "Renamed by a teammate"));
  expect(input.value).toBe("Renamed by a teammate");
});
