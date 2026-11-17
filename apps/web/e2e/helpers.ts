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
