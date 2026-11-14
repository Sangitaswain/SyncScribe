import { expect, it } from "vitest";
import { cmDoc, docDoc, parseDocName, userDoc, wsDoc } from "./index";

it("builds and parses document names", () => {
  expect([wsDoc("w"), docDoc("d"), cmDoc("d"), userDoc("u")]).toEqual(["ws:w", "doc:d", "cm:d", "user:u"]);
  expect(parseDocName("doc:abc")).toEqual({ kind: "doc", id: "abc" });
  expect(parseDocName("nope:abc")).toBeNull();
});
