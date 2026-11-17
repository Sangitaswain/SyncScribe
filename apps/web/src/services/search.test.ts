import { expect, it } from "vitest";
import { DOC, docDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { newDocument } from "../crdt/actions";
import { getDoc, releaseDoc } from "../crdt/registry";
import { buildIndex, search } from "./search";

useSession.setState({
  user: { id: "u3", email: "", name: "", color: "", personalWorkspaceId: "w3" },
  workspaces: [{ id: "w3", name: "Mine", kind: "personal", role: "owner" }],
});

it("finds documents on the device by words in their content or title (I1)", async () => {
  const rivers = await newDocument("w3", null, "Floods change how rivers shape the valley.", "Geography notes");
  const recipe = await newDocument("w3", null, "Bake the bread for 40 minutes.", "Rivers café menu");
  await buildIndex();

  const results = search("rivers");
  expect(results.map((r) => r.id)).toEqual([recipe, rivers]); // title matches rank first
  expect(results[1]).toMatchObject({
    title: "Geography notes",
    snippet: { before: "Floods change how ", match: "rivers", after: " shape the valley." },
  });
  expect(search("bre").map((r) => r.id)).toEqual([recipe]); // prefix, as you type
  expect(search("rivers", (id) => id !== recipe).map((r) => r.id)).toEqual([rivers]); // e.g. hide Trash
  expect(search("  ")).toEqual([]);
});

it("picks up edits shortly after typing stops", async () => {
  const id = await newDocument("w3", null, "", "Empty for now");
  await buildIndex();
  expect(search("photosynthesis")).toEqual([]);
  const doc = await getDoc(docDoc(id));
  doc.getText(DOC.content).insert(0, "Plants use photosynthesis.");
  await new Promise((r) => setTimeout(r, 600));
  expect(search("photosynthesis").map((r) => r.id)).toEqual([id]);
  releaseDoc(docDoc(id));
});
