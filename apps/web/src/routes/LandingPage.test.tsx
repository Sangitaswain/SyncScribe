// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import LandingPage from "./LandingPage";
import { useSession } from "../stores/session";

it("shows the hero, sections and sign-up links to signed-out visitors", () => {
  useSession.setState({ status: "signedOut" });
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Write anywhere.Sync everywhere.");
  for (const h of ["Zero conflicts.", "Questions? Answers.", "Start writing today."]) expect(screen.getByRole("heading", { name: h })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 3 }).map((e) => e.textContent)).toContain("Saved on your device.");
  for (const a of screen.getAllByRole("link", { name: "Get started" })) expect(a.getAttribute("href")).toBe("/signup");
  expect(screen.getAllByRole("link", { name: "Sign in" }).map((a) => a.getAttribute("href"))).toEqual(["/login", "/login"]); // nav + footer
});
