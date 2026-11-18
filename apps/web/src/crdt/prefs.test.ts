import { expect, it } from "vitest";
import * as Y from "yjs";
import { USER } from "@syncscribe/shared";
import { addRecent, setSetting, togglePin } from "./prefs";

it("keeps recents unique, newest first, max 20", () => {
  const prefs = new Y.Doc();
  for (let i = 0; i < 25; i++) addRecent(prefs, `d${i}`);
  addRecent(prefs, "d10");
  const ids = prefs.getArray<{ docId: string }>(USER.recents).toArray().map((r) => r.docId);
  expect(ids).toHaveLength(20);
  expect(ids[0]).toBe("d10");
  expect(ids.filter((d) => d === "d10")).toHaveLength(1);
});

it("toggles pins and stores settings", () => {
  const prefs = new Y.Doc();
  togglePin(prefs, "a");
  togglePin(prefs, "b");
  togglePin(prefs, "a");
  expect(prefs.getArray(USER.pins).toArray()).toEqual(["b"]);
  setSetting(prefs, "sort", "name");
  expect(prefs.getMap(USER.settings).get("sort")).toBe("name");
});

it("pins stay pinned on the user's other devices (B8)", async () => {
  const Y = await import("yjs");
  const { USER } = await import("@syncscribe/shared");
  const { togglePin } = await import("./prefs");
  const laptop = new Y.Doc();
  const phone = new Y.Doc();
  togglePin(laptop, "doc-1");
  Y.applyUpdate(phone, Y.encodeStateAsUpdate(laptop));
  expect(phone.getArray(USER.pins).toArray()).toEqual(["doc-1"]);
  togglePin(phone, "doc-1");
  Y.applyUpdate(laptop, Y.encodeStateAsUpdate(phone));
  expect(laptop.getArray(USER.pins).toArray()).toEqual([]);
});
