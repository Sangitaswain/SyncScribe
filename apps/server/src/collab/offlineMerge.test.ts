import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { DOC } from "@syncscribe/shared";
import { app } from "../app";
import { db } from "../db/db";
import { connect, startServer, until } from "../test/collabServer";

// PRD 4.5: two people edit the same document while offline, then reconnect one after the other.
// Each client keeps its own Y.Doc while disconnected, as the app does with IndexedDB.

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;

it("merges two users' offline edits without losing text (PRD 4.5)", async () => {
  const priya = await signup("Priya");
  const ali = await signup("Ali");
  // Ali is an editor in Priya's workspace (sharing UI comes in Step 13)
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'editor')").run(
    priya.user.personalWorkspaceId,
    ali.user.id,
  );
  const { names } = (await request(app).get("/api/sync/all").set("Authorization", `Bearer ${priya.token}`)).body;
  const name = names.find((n: string) => n.startsWith("doc:"));

  // 1. Both have "Group Report" on their devices
  const p = await connect(srv.port, name, priya.token);
  const report = p.doc.getText(DOC.content);
  report.delete(0, report.length);
  report.insert(0, "# Introduction\nThis report is about rivers. Our projcet studies floods.\n");
  const a = await connect(srv.port, name, ali.token);
  await until(() => a.doc.getText(DOC.content).toString() === report.toString());

  // 2. Both go offline and edit
  p.provider.destroy();
  a.provider.destroy();
  const pText = p.doc.getText(DOC.content);
  const aText = a.doc.getText(DOC.content);
  const first = "This report is about rivers.";
  pText.delete(pText.toString().indexOf(first), first.length);
  pText.insert(pText.toString().indexOf(" Our"), "Rivers shape how cities grow.");
  const typo = aText.toString().indexOf("projcet");
  aText.delete(typo, "projcet".length);
  aText.insert(typo, "project");
  aText.insert(aText.length, "# Conclusion\nFloods can be predicted.\n");
  // Both type at the exact same spot (right after the heading)
  pText.insert("# Introduction".length, " (Priya)");
  aText.insert("# Introduction".length, " (Ali)");

  // 3–4. Priya reconnects first, then Ali
  const p2 = await connect(srv.port, name, priya.token, p.doc);
  await until(() => p2.provider.unsyncedChanges === 0);
  const a2 = await connect(srv.port, name, ali.token, a.doc);
  await until(() => a2.provider.unsyncedChanges === 0);

  // 5–6. Identical content for both, nothing lost, same-spot text kept side by side
  await until(() => pText.toString() === aText.toString());
  const merged = pText.toString();
  expect(merged).toContain("Rivers shape how cities grow.");
  expect(merged).not.toContain(first);
  expect(merged).toContain("Our project studies floods."); // Ali's typo fix, where the text still exists
  expect(merged).toContain("# Conclusion\nFloods can be predicted.");
  expect(merged).toMatch(/^# Introduction( \(Priya\)| \(Ali\)){2}\n/);
  expect(merged).toContain("(Priya)");
  expect(merged).toContain("(Ali)");

  // A third device opening the doc afterwards gets the same bytes
  const later = await connect(srv.port, name, priya.token);
  await until(() => later.doc.getText(DOC.content).toString() === merged);
  for (const c of [p2, a2, later]) c.provider.destroy();
});
