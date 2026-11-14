import { expect, it } from "vitest";
import { countWords, readingMinutes } from "./text";

it("counts words ignoring markdown symbols", () => {
  expect(countWords("# Hello  world\n\n- [ ] task one\n---\n**bold** café 42")).toBe(7);
  expect(countWords("   ")).toBe(0);
});

it("estimates reading time", () => {
  expect(readingMinutes(0)).toBe(0);
  expect(readingMinutes(50)).toBe(1);
  expect(readingMinutes(1000)).toBe(5);
});
