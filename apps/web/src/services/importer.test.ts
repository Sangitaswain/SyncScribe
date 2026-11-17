import { expect, it } from "vitest";
import { DOC, docDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { getDoc } from "../crdt/registry";
import { importFiles } from "./importer";

useSession.setState({ user: { id: "u8", email: "", name: "", color: "", personalWorkspaceId: "w8" } });

it("imports the valid files and names the ones it rejected (J1, EC35)", async () => {
  const files = [
    new File(["# Lecture 1\n\nNotes"], "Lecture 1.md"),
    new File(["plain text"], "todo.txt"),
    new File(["%PDF-1.4"], "slides.pdf"),
    new File(["ab\u0000\u0001cd"], "broken.md"), // binary content with a text extension
  ];
  const { imported, failed } = await importFiles(files, "w8");
  expect(failed).toEqual([
    { name: "slides.pdf", reason: "is not a .md or .txt file" },
    { name: "broken.md", reason: "isn't a text file" },
  ]);
  expect(imported).toHaveLength(2);
  const first = await getDoc(docDoc(imported[0]));
  expect(first.getMap(DOC.meta).get("title")).toBe("Lecture 1");
  expect(first.getText(DOC.content).toString()).toBe("# Lecture 1\n\nNotes");
  expect((await getDoc(docDoc(imported[1]))).getMap(DOC.meta).get("title")).toBe("todo");
});
