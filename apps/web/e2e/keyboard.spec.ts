import { expect, test, type Page } from "@playwright/test";

// The main flows with the keyboard only: no clicks anywhere (19.2)

/** Presses Tab (or Shift+Tab) until the focused element's label or text matches `name`. */
async function tabTo(page: Page, name: string | RegExp, { back = false, max = 60 } = {}) {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return `${el?.getAttribute("aria-label") ?? ""}|${el?.textContent ?? ""}|${el?.getAttribute("placeholder") ?? ""}`;
    });
    if (typeof name === "string" ? label.split("|").some((part) => part.trim() === name) : name.test(label)) return;
    seen.push(label.slice(0, 40));
  }
  throw new Error(`Couldn't reach "${name}" with Tab; focus went to: ${[...new Set(seen)].join(" / ")}`);
}

test("sign up, write, search, organise and use Trash with the keyboard only", async ({ page }) => {
  await page.goto("/signup");
  await tabTo(page, "Name");
  await page.keyboard.type("Keys");
  await page.keyboard.press("Tab");
  await page.keyboard.type(`keys-${Date.now()}@example.test`);
  await page.keyboard.press("Tab");
  await page.keyboard.type("e2e-test-password");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Welcome to SyncScribe" })).toBeVisible();
  await page.keyboard.press("Enter"); // Next
  await page.keyboard.press("Escape"); // skip the rest
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // New document: title, then Enter into the text
  await page.keyboard.press("ControlOrMeta+Alt+n");
  await expect(page.getByLabel("Document title")).toBeFocused();
  await page.keyboard.type("Keyboard notes");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Written without a mouse: albatross.");
  await expect(page.locator(".cm-content")).toContainText("albatross");

  // Search all documents and open the match
  await page.keyboard.press("ControlOrMeta+Shift+F");
  await page.keyboard.type("albatross");
  await expect(page.locator("mark")).toHaveText("albatross");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Document title")).toHaveValue("Keyboard notes");

  // A folder: create, name, collapse. In the editor Tab indents; Escape then Tab leaves it (CodeMirror)
  await expect(page.locator(".cm-content")).toBeFocused(); // opening a search result selects the match
  await page.keyboard.press("Escape"); // first Escape collapses that selection…
  await page.keyboard.press("Escape"); // …the next lets Tab leave the editor
  await tabTo(page, "New folder", { back: true }); // the sidebar comes before the editor
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Course");
  await page.keyboard.press("Enter");
  await tabTo(page, /^\|Course\|/);
  await expect(page.locator(":focus")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus")).toHaveAttribute("aria-expanded", "false");

  // Delete a doc from its row menu, then restore it from Trash
  await tabTo(page, "Actions for Keyboard notes");
  await page.keyboard.press("Enter");
  await tabTo(page, "Delete");
  await page.keyboard.press("Enter");
  await expect(page.getByText('"Keyboard notes" moved to Trash')).toBeVisible();
  await tabTo(page, /^\|Trash\|/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Trash" })).toBeVisible();
  await tabTo(page, "Restore");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Trash is empty.")).toBeVisible();
});
