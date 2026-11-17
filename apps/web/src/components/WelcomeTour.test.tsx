// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { USER, userDoc } from "@syncscribe/shared";
import WelcomeTour from "./WelcomeTour";
import { getDoc } from "../crdt/registry";
import { useSession } from "../stores/session";

it("shows the three-step tour once per user (J4)", async () => {
  useSession.setState({ user: { id: "tour1", email: "", name: "", color: "", personalWorkspaceId: "w" } });
  render(<WelcomeTour />);
  await screen.findByText("Works without internet");
  fireEvent.click(screen.getByText("Next"));
  await screen.findByText("Syncs by itself");
  fireEvent.click(screen.getByText("Next"));
  await screen.findByText("Step 3 of 3");
  expect(screen.getByText(/clearing your browser data deletes changes that haven't synced yet/)).toBeTruthy(); // EC26
  fireEvent.click(screen.getByText("Start writing"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await getDoc(userDoc("tour1"))).getMap(USER.settings).get("tourDone")).toBe(true);

  // Next visit (or another device, once preferences sync): not shown again
  cleanup();
  render(<WelcomeTour />);
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole("dialog")).toBeNull();

  // Another person on this device gets their own tour
  cleanup();
  useSession.setState({ user: { id: "tour2", email: "", name: "", color: "", personalWorkspaceId: "w" } });
  render(<WelcomeTour />);
  await screen.findByText("Works without internet");
  fireEvent.click(screen.getByText("Skip"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
