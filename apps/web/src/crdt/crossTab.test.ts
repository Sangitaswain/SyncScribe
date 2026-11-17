import { expect, it, vi } from "vitest";

// Two "tabs": two copies of the app's modules sharing one IndexedDB, with no sync server at all (offline).
const user = { id: "u7", email: "", name: "", color: "", personalWorkspaceId: "w7" };

async function openTab() {
  vi.resetModules();
  const { useSession } = await import("../stores/session");
  useSession.setState({ user });
  return import("./registry");
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(check()).toBe(true);
};

it("two tabs mirror each other's typing while offline (EC28, DF16)", async () => {
  const tabA = await openTab();
  const tabB = await openTab();
  const a = (await tabA.getDoc("doc:shared")).getText("content");
  const b = (await tabB.getDoc("doc:shared")).getText("content");

  a.insert(0, "from A ");
  await until(() => b.toString() === "from A ");
  b.insert(b.length, "and B");
  await until(() => a.toString() === "from A and B");

  // A third tab opening later catches up, then joins in
  const tabC = await openTab();
  const c = (await tabC.getDoc("doc:shared")).getText("content");
  await until(() => c.toString() === "from A and B");
  c.insert(0, "C: ");
  await until(() => a.toString() === "C: from A and B" && b.toString() === a.toString());

  for (const tab of [tabA, tabB, tabC]) tab.closeAll();
});
