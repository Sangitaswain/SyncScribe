import { expect, test } from "@playwright/test";
import { appCachedOffline, badge, editorText, newUser, typeInEditor } from "./helpers";

// docs/DEMO_SCRIPT.md, step by step: an automated rehearsal of the 5-minute demo
test("the demo script runs end to end", async ({ browser }) => {
  test.setTimeout(180_000);
  const priya = await newUser(browser, "Priya");
  const ali = await newUser(browser, "Ali");
  const p = priya.page;
  const a = ali.page;
  await appCachedOffline(p);

  // 1. It works offline
  await p.getByRole("button", { name: "New doc" }).first().click();
  await p.getByLabel("Document title").fill("Group Report");
  await typeInEditor(p, "Introduction: rivers shape cities.");
  await expect(badge(p, "Synced")).toBeVisible({ timeout: 20_000 });
  await priya.context.setOffline(true);
  await expect(badge(p, "Offline")).toBeVisible({ timeout: 10_000 });
  await expect(p.getByText(/Your changes are saved on this device/)).toBeVisible();
  await typeInEditor(p, " Floods are getting worse.");
  await expect(p.getByTitle("Not synced yet")).toBeVisible();
  await p.waitForTimeout(300); // a presenter pauses before reloading
  await p.reload();
  await expect(p.locator(".cm-content")).toContainText("Floods are getting worse.");

  // 2. It syncs by itself
  await priya.context.setOffline(false);
  await expect(badge(p, "Synced")).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTitle("Not synced yet")).toHaveCount(0);

  // 3. Sharing and live collaboration
  await p.getByRole("button", { name: "Share" }).click();
  await p.getByLabel("Email address").fill(ali.email);
  await p.getByRole("button", { name: "Invite" }).click();
  await expect(p.getByText(`Invited ${ali.email}`)).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(a.getByLabel(/Notifications, 1 unread/)).toBeVisible({ timeout: 20_000 });
  await a.goto("/shared");
  await a.getByText("Group Report").click();
  await expect(a.locator(".cm-content")).toContainText("Floods are getting worse.");
  await typeInEditor(a, " Ali says hi.");
  await expect(p.locator(".cm-content")).toContainText("Ali says hi.");
  await expect(p.locator(".cm-ySelectionInfo", { hasText: "Ali" })).toBeAttached(); // Ali's named cursor
  await expect(p.getByLabel("People in this document").getByTitle("Ali")).toBeVisible(); // presence avatar

  // 4. Two people offline, same paragraph
  await expect(badge(a, "Synced")).toBeVisible({ timeout: 20_000 });
  await priya.context.setOffline(true);
  await ali.context.setOffline(true);
  await expect(badge(p, "Offline")).toBeVisible({ timeout: 10_000 });
  await expect(badge(a, "Offline")).toBeVisible({ timeout: 10_000 });
  await typeInEditor(p, " Priya's new intro.");
  await typeInEditor(a, "\nConclusion: build levees.");
  await expect(p.locator(".cm-content")).not.toContainText("Conclusion");
  await priya.context.setOffline(false);
  await expect(badge(p, "Synced")).toBeVisible({ timeout: 30_000 });
  await ali.context.setOffline(false);
  await expect(badge(a, "Synced")).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    const [mine, theirs] = [await editorText(p), await editorText(a)];
    expect(mine).toBe(theirs);
    expect(mine).toContain("Priya's new intro.");
    expect(mine).toContain("Conclusion: build levees.");
  }).toPass({ timeout: 20_000 });
  const merged = await editorText(p);

  // 5. Version history: name a version, then restore an older one
  await p.getByLabel("Version history").click();
  await p.getByLabel("Version name").fill("Before review");
  await p.getByRole("button", { name: "Save" }).click();
  await expect(p.getByText("Version saved")).toBeVisible();
  await expect(p.getByRole("button", { name: /Before review/ })).toBeVisible();
  const oldest = p.getByLabel("Versions").getByRole("button").last();
  await oldest.click();
  await p.getByRole("button", { name: "Restore this version" }).click();
  await expect(p.getByLabel("Document title")).toBeVisible();
  await expect(async () => expect(await editorText(a)).toBe(await editorText(p))).toPass({ timeout: 20_000 }); // Ali gets it too
  await p.getByLabel("Version history").click();
  await expect(p.getByRole("button", { name: /Before restoring/ })).toBeVisible(); // today's text kept
  expect(merged).toContain("Conclusion: build levees.");
  await ali.context.close();
  await priya.context.close();
});
