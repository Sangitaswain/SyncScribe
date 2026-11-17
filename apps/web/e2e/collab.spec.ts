import { expect, test } from "@playwright/test";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { appCachedOffline, badge, editorText, newUser, sharedDoc, signUp, typeInEditor } from "./helpers";
import { API_PORT } from "./ports";

// E2E 5–8 from FP-18

test("5. a viewer can't type, and an edit forged outside the app is thrown away by the server (G5, EC18)", async ({ browser, request }) => {
  const viewer = await newUser(browser, "Viewer");
  const owner = await newUser(browser, "Owner");
  const docUrl = await sharedDoc(owner, viewer, { title: "Read only", text: "Original text.", role: "viewer" });

  await expect(viewer.page.getByText("You can view this document but not edit it.")).toBeVisible({ timeout: 20_000 });
  await expect(viewer.page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
  await viewer.page.keyboard.type("typed by viewer");
  await expect(viewer.page.getByLabel("Document title")).toHaveJSProperty("readOnly", true);

  // A modified client: connect with the viewer's credentials and write anyway
  const { token } = await (
    await request.post(`http://localhost:${API_PORT}/api/auth/login`, { data: { email: viewer.email, password: "e2e-test-password" } })
  ).json();
  const forged = new Y.Doc();
  const provider = new HocuspocusProvider({ url: `ws://localhost:${API_PORT}/collab`, name: `doc:${docUrl.split("/").pop()}`, document: forged, token });
  await expect.poll(() => provider.isSynced, { timeout: 10_000 }).toBe(true);
  forged.getText("content").insert(0, "FORGED ");
  await owner.page.waitForTimeout(1000);
  expect(await editorText(owner.page)).not.toContain("FORGED");
  expect(await editorText(owner.page)).not.toContain("typed by viewer");
  provider.destroy();
  await viewer.context.close();
  await owner.context.close();
});

test("6. access removed while offline: edits aren't accepted, and the local copy can be exported (EC16)", async ({ browser }) => {
  const guest = await newUser(browser, "Guest");
  const owner = await newUser(browser, "Host");
  await sharedDoc(owner, guest, { title: "Revoked plan", text: "Shared plan." });
  await expect(badge(guest.page, "Synced")).toBeVisible({ timeout: 20_000 });

  await guest.context.setOffline(true);
  await expect(badge(guest.page, "Offline")).toBeVisible({ timeout: 10_000 });
  await typeInEditor(guest.page, " Guest's offline idea.");

  // Meanwhile the owner removes the guest's access
  await owner.page.getByRole("button", { name: "Share" }).click();
  await owner.page.getByRole("button", { name: "Remove" }).click();
  await expect(owner.page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await owner.page.keyboard.press("Escape");

  await guest.context.setOffline(false);
  await expect(guest.page.getByText(/Your access to this document was removed/)).toBeVisible({ timeout: 30_000 });
  const download = guest.page.waitForEvent("download");
  await guest.page.getByRole("button", { name: "Export my local copy" }).click();
  expect((await download).suggestedFilename()).toBe("Revoked plan.md");
  expect(await editorText(owner.page)).not.toContain("Guest's offline idea.");
  await guest.context.close();
  await owner.context.close();
});

test("7. two tabs of the same doc stay identical while offline (EC28, DF16)", async ({ page, context }) => {
  await signUp(page, "Tabs");
  await appCachedOffline(page);
  await page.getByText("Welcome to SyncScribe").first().click();
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.locator(".cm-content")).toContainText("Welcome to SyncScribe");

  await context.setOffline(true);
  await typeInEditor(page, "\nFrom the first tab.");
  await expect(second.locator(".cm-content")).toContainText("From the first tab.");
  await typeInEditor(second, "\nFrom the second tab.");
  await expect(page.locator(".cm-content")).toContainText("From the second tab.");
  expect(await editorText(page)).toBe(await editorText(second));
});

test("8. search finds a document by its content while offline (I1, 4.11)", async ({ page, context }) => {
  await signUp(page, "Finder");
  await appCachedOffline(page);
  await page.getByRole("button", { name: "New doc" }).first().click();
  await page.getByLabel("Document title").fill("Field trip");
  await typeInEditor(page, "We saw a kingfisher by the river.");
  await expect(page.locator(".cm-content")).toContainText("kingfisher");
  await page.waitForTimeout(300); // a person's pause before leaving (see test 2)
  await page.goto("/");

  await context.setOffline(true);
  await page.reload();
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("textbox", { name: "Search" }).fill("kingfisher");
  await expect(page.locator("mark")).toHaveText("kingfisher");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Document title")).toHaveValue("Field trip");
});
