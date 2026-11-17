import { expect, type Browser, type Page } from "@playwright/test";

let n = 0;
/** A new account through the sign-up screen; lands on All docs with the Welcome doc. */
export async function signUp(page: Page, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}-${n++}@example.test`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill(name);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/Password/).fill("e2e-test-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByRole("button", { name: "Skip" }).click(); // the first-run tour (J4)
  await expect(page.getByRole("heading", { name: "All docs" })).toBeVisible();
  return email;
}

export async function newUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = await signUp(page, name);
  return { context, page, email };
}

/** Waits until the service worker has cached the app, so it can open offline. */
export const appCachedOffline = (page: Page) => page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

export const badge = (page: Page, text: string) => page.getByRole("status").filter({ hasText: new RegExp(`^${text}`) });

/** Types into the markdown editor at the end of the document. */
export async function typeInEditor(page: Page, text: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(text);
}

/** The document text in the editor, without collaborators' cursor name labels. */
export const editorText = (page: Page) =>
  page.locator(".cm-content").evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".cm-ySelectionCaret, .cm-widgetBuffer").forEach((n) => n.remove());
    return [...copy.querySelectorAll(".cm-line")].map((l) => l.textContent).join("\n");
  });

/** The owner creates a doc and shares it; the invitee opens it from "Shared with me". */
export async function sharedDoc(
  owner: { page: Page },
  invitee: { page: Page; email: string },
  { title, text, role = "editor" }: { title: string; text: string; role?: "editor" | "commenter" | "viewer" },
) {
  await owner.page.getByRole("button", { name: "New doc" }).first().click();
  await owner.page.getByLabel("Document title").fill(title);
  await typeInEditor(owner.page, text);
  const docUrl = new URL(owner.page.url()).pathname;
  await owner.page.getByRole("button", { name: "Share" }).click();
  await owner.page.getByLabel("Email address").fill(invitee.email);
  await owner.page.getByLabel("Role").first().selectOption(role);
  await owner.page.getByRole("button", { name: "Invite" }).click();
  await expect(owner.page.getByText(`Invited ${invitee.email}`)).toBeVisible();
  await owner.page.keyboard.press("Escape");
  await expect(badge(owner.page, "Synced")).toBeVisible({ timeout: 20_000 });

  await invitee.page.goto("/shared");
  await invitee.page.getByText(title).click();
  await expect(invitee.page.locator(".cm-content")).toContainText(text);
  return docUrl;
}
