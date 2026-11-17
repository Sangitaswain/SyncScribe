import { expect, it } from "vitest";
import { db } from "../db/db";
import { roleFor } from "./resolve";

// Every rule of BP-4.2, on rows inserted straight into the in-memory database.
const now = Date.now();
for (const id of ["owner", "member", "guest", "stranger"])
  db.prepare("INSERT INTO users VALUES (?, ?, ?, 'x', '#000', ?, ?)").run(id, `${id}@example.com`, id, `p-${id}`, now);
db.prepare("INSERT INTO workspaces VALUES ('w', 'Team', 'team', 'owner', ?)").run(now);
db.prepare("INSERT INTO workspace_members VALUES ('w', 'owner', 'owner'), ('w', 'member', 'commenter')").run();
const item = (id: string, parent: string | null, type = "doc") =>
  db.prepare("INSERT INTO documents (id, workspace_id, parent_id, type, owner_id, updated_at) VALUES (?, 'w', ?, ?, 'owner', ?)").run(
    id,
    parent,
    type,
    now,
  );
const share = (resource: string, user: string, role: string) =>
  db.prepare("INSERT INTO shares (id, resource_id, user_id, role, created_by, created_at) VALUES (?, ?, ?, ?, 'owner', ?)").run(
    `${resource}-${user}`,
    resource,
    user,
    role,
    now,
  );

item("top", null, "folder");
item("sub", "top", "folder");
item("deep", "sub");
item("plain", null);
item("loopA", "loopB", "folder");
item("loopB", "loopA", "folder");
item("inLoop", "loopA");

it("user docs belong only to their user", () => {
  expect(roleFor("owner", "user:owner")).toBe("owner");
  expect(roleFor("member", "user:owner")).toBe("none");
});

it("workspace trees follow workspace membership", () => {
  expect(roleFor("owner", "ws:w")).toBe("owner");
  expect(roleFor("member", "ws:w")).toBe("commenter");
  expect(roleFor("guest", "ws:w")).toBe("none");
});

it("docs: owner, workspace role, direct share and ancestor folder share; the highest wins", () => {
  expect(roleFor("owner", "doc:plain")).toBe("owner");
  expect(roleFor("member", "doc:plain")).toBe("commenter"); // workspace role
  expect(roleFor("guest", "doc:plain")).toBe("none");

  share("plain", "guest", "viewer");
  expect(roleFor("guest", "doc:plain")).toBe("viewer"); // direct share
  share("plain", "member", "editor");
  expect(roleFor("member", "doc:plain")).toBe("editor"); // share beats a lower workspace role

  share("top", "guest", "commenter");
  expect(roleFor("guest", "doc:deep")).toBe("commenter"); // folder two levels up
  share("deep", "guest", "viewer");
  expect(roleFor("guest", "doc:deep")).toBe("commenter"); // highest of doc and folder shares
  expect(roleFor("stranger", "doc:deep")).toBe("none");
});

it("comments follow their doc, unknown docs are null, and folder loops end", () => {
  expect(roleFor("guest", "cm:deep")).toBe("commenter");
  expect(roleFor("guest", "doc:missing")).toBeNull();
  share("loopB", "guest", "editor");
  expect(roleFor("guest", "doc:inLoop")).toBe("editor");
  expect(roleFor("stranger", "doc:inLoop")).toBe("none");
  expect(roleFor("owner", "bogus")).toBe("none");
});
