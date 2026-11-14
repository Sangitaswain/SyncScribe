// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import LandingPage from "./LandingPage";
import { useSession } from "../stores/session";

it("shows the hero, sections and sign-up links to signed-out visitors", () => {
  useSession.setState({ status: "signedOut" });
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Write together,offline.");
  for (const h of ["Made for the things students actually write", "Good questions, short answers", "Start writing. The Wi-Fi can wait."])
    expect(screen.getByRole("heading", { name: h })).toBeTruthy();
  for (const a of screen.getAllByRole("link", { name: /get started/i })) expect(a.getAttribute("href")).toBe("/signup");
  expect(screen.getAllByRole("link", { name: "Sign in" }).map((a) => a.getAttribute("href"))).toEqual(["/login", "/login"]); // nav + footer
});
