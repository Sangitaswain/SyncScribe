// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import * as Y from "yjs";
import MarkdownPreview from "./MarkdownPreview";

const preview = (md: string) => {
  const ytext = new Y.Doc().getText("content");
  ytext.insert(0, md);
  return render(<MarkdownPreview ytext={ytext} />).container;
};

it("renders GitHub-flavoured markdown", async () => {
  const c = preview("# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n~~old~~");
  await waitFor(() => expect(c.querySelector("h1")?.textContent).toBe("Title"));
  expect(c.querySelector("table td")?.textContent).toBe("1");
  expect(c.querySelector('input[type="checkbox"]')).toBeTruthy();
  expect(c.querySelector("del")?.textContent).toBe("old");
});

it("never runs scripts or unsafe HTML (EC37)", async () => {
  const c = preview('Hi <script>window.hacked = true</script> <img src=x onerror="window.hacked=true"> [x](javascript:alert(1))');
  await waitFor(() => expect(c.textContent).toContain("Hi"));
  expect(c.querySelector("script")).toBeNull();
  expect(c.querySelector("[onerror]")).toBeNull();
  expect(c.querySelector('a[href^="javascript"]')).toBeNull();
  expect((window as { hacked?: boolean }).hacked).toBeUndefined();
});

it("shows broken markdown best-effort instead of failing (EC33)", async () => {
  const c = preview("**unclosed *mess [link](  \n```\nno end");
  await waitFor(() => expect(c.textContent).toContain("no end"));
});
