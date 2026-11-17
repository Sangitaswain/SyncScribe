// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { AppNotification } from "@syncscribe/shared";
import NotificationBell from "./NotificationBell";
import { useNotifications } from "../stores/notifications";
import { receive } from "../services/notifications";

const sent: unknown[] = [];
vi.mock("../services/outbox", () => ({ sendOrQueue: async (...args: unknown[]) => sent.push(args) }));

const n = (id: string, type: AppNotification["type"], payload: Record<string, unknown>, readAt: number | null = null): AppNotification => ({
  id,
  type,
  payload,
  readAt,
  createdAt: Date.UTC(2026, 10, 17),
});

it("shows the unread count and marks notifications read (J3)", async () => {
  useNotifications.setState({
    items: [
      n("n1", "shared", { resourceId: "d1", title: "Group report", by: "Priya" }),
      n("n2", "mentioned", { docId: "d2", title: "Plan", by: "Ali" }),
      n("n3", "access_removed", { resourceId: "d3", title: "Old" }, 1),
    ],
  });
  render(
    <MemoryRouter>
      <NotificationBell />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/doc/:docId" element={<p>Opened doc</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByLabelText("Notifications, 2 unread"));
  expect(screen.getByText('Ali mentioned you in "Plan"')).toBeTruthy();
  expect(screen.getByText('Your access to "Old" was removed')).toBeTruthy();

  fireEvent.click(screen.getByText('Priya shared "Group report" with you'));
  await screen.findByText("Opened doc");
  expect(screen.getByLabelText("Notifications, 1 unread")).toBeTruthy();
  expect(sent).toContainEqual(["Marking notifications as read", "POST", "/notifications/read", { ids: ["n1"] }]);

  fireEvent.click(screen.getByLabelText("Notifications, 1 unread"));
  fireEvent.click(screen.getByText("Mark all as read"));
  expect(screen.getByLabelText("Notifications")).toBeTruthy();

  receive(n("n4", "role_changed", { resourceId: "d1", title: "Group report", role: "viewer" }));
  receive(n("n4", "role_changed", { resourceId: "d1", title: "Group report", role: "viewer" })); // same one twice
  expect(await screen.findByLabelText("Notifications, 1 unread")).toBeTruthy();
});
