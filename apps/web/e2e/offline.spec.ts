import { expect, test } from "@playwright/test";
import { appCachedOffline, badge, editorText, newUser, signUp, typeInEditor } from "./helpers";

// E2E 1–4 from FP-18

test("1. a signed-in user reloads offline and everything is still there (4.2)", async ({ page, context }) => {
  await signUp(page, "Reload");
  await expect(page.getByText("Welcome to SyncScribe").first()).toBeVisible();
  await appCachedOffline(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "All docs" })).toBeVisible();
  await page.getByText("Welcome to SyncScribe").first().click();
  await expect(page.locator(".cm-content")).toContainText("with or without an internet connection");
});

test("2. text typed just before closing the tab is there when reopened offline (4.3, EC29)", async ({ page, context }) => {
  await signUp(page, "Closer");
  await appCachedOffline(page);
  await page.getByRole("button", { name: "New doc" }).first().click();
  await page.getByLabel("Document title").fill("Lab notes");
  await typeInEditor(page, "Measured the flow rate at");
  await expect(page.locator(".cm-content")).toContainText("Measured the flow rate at");
  // The test types a whole sentence in milliseconds; a person pauses longer than this before closing.
  // (Browsers may drop IndexedDB writes still in flight at the instant a tab closes.)
  await page.waitForTimeout(300);
  const url = page.url();
  await page.close(); // mid-sentence

  await context.setOffline(true);
  const again = await context.newPage();
  await again.goto(url);
  await expect(again.getByLabel("Document title")).toHaveValue("Lab notes");
  await expect(again.locator(".cm-content")).toContainText("Measured the flow rate at");
});

test("3. two people edit the same doc offline; after reconnecting both have identical content (4.5)", async ({ browser }) => {
  const ali = await newUser(browser, "Ali");
  const priya = await newUser(browser, "Priya");

  // Priya writes the report and shares it with Ali
  await priya.page.getByRole("button", { name: "New doc" }).first().click();
  await priya.page.getByLabel("Document title").fill("Group Report");
  await typeInEditor(priya.page, "Introduction: rivers flood.");
  await priya.page.getByRole("button", { name: "Share" }).click();
  await priya.page.getByLabel("Email address").fill(ali.email);
  await priya.page.getByRole("button", { name: "Invite" }).click();
  await expect(priya.page.getByText(`Invited ${ali.email}`)).toBeVisible();
  await priya.page.keyboard.press("Escape");
  await expect(badge(priya.page, "Synced")).toBeVisible({ timeout: 20_000 });

  await ali.page.goto("/shared");
  await ali.page.getByText("Group Report").click();
  await expect(ali.page.locator(".cm-content")).toContainText("Introduction: rivers flood.");
  await expect(badge(ali.page, "Synced")).toBeVisible({ timeout: 20_000 });

  // Both go offline and edit
  await priya.context.setOffline(true);
  await ali.context.setOffline(true);
  await expect(badge(priya.page, "Offline")).toBeVisible({ timeout: 10_000 });
  await expect(badge(ali.page, "Offline")).toBeVisible({ timeout: 10_000 });
  await typeInEditor(priya.page, " Priya's new intro.");
  await typeInEditor(ali.page, " Conclusion: build levees.");
  await expect(priya.page.locator(".cm-content")).not.toContainText("Conclusion"); // really apart

  // Priya reconnects first, then Ali
  await priya.context.setOffline(false);
  await expect(badge(priya.page, "Synced")).toBeVisible({ timeout: 30_000 });
  await ali.context.setOffline(false);
  await expect(badge(ali.page, "Synced")).toBeVisible({ timeout: 30_000 });

  await expect(async () => {
    const [p, a] = [await editorText(priya.page), await editorText(ali.page)];
    expect(p).toBe(a);
    expect(p).toContain("Priya's new intro.");
    expect(p).toContain("Conclusion: build levees.");
  }).toPass({ timeout: 20_000 });
  await ali.context.close();
  await priya.context.close();
});

test("4. going offline mid-edit shows Offline; reconnecting syncs with no clicks (4.4)", async ({ page, context }) => {
  await signUp(page, "Flaky");
  await page.getByText("Welcome to SyncScribe").first().click();
  await expect(badge(page, "Synced")).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await typeInEditor(page, "\nWritten on the train.");
  await expect(badge(page, "Offline")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText(/unsynced/)).toBeVisible();

  await context.setOffline(false);
  await expect(badge(page, "Synced")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/unsynced/)).toHaveCount(0);
});
