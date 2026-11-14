import { expect, it } from "vitest";
import { DOC, docDoc, wsDoc } from "@syncscribe/shared";
import { duplicateDocument, newDocument } from "./actions";
import { getDoc } from "./registry";
import { readItem } from "./tree";
import { useSession } from "../stores/session";

useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });

it("creates and duplicates documents through the registry", async () => {
  const id = await newDocument("w1", null, "# Notes", "My notes");
  const copy = await duplicateDocument("w1", id);
  const ws = await getDoc(wsDoc("w1"));
  expect(readItem(ws, id)?.type).toBe("doc");
  expect(readItem(ws, copy)?.parentId).toBeNull();
  const doc = await getDoc(docDoc(copy));
  expect(doc.getMap(DOC.meta).get("title")).toBe("Copy of My notes");
  expect(doc.getText(DOC.content).toString()).toBe("# Notes");
});
