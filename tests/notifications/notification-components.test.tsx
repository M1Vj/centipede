// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NotificationInboxShell } from "@/components/notifications/notification-inbox-shell";
import { NotificationPreferencesShell } from "@/components/notifications/notification-preferences-shell";
import { NotificationBellDropdown } from "@/components/notifications/notification-bell-dropdown";

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    className,
    href,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe("notification components", () => {
  test("renders inbox notifications with unread count and mark-read controls", () => {
    render(
      <NotificationInboxShell
        notifications={[
          {
            id: "notification-1",
            title: "Leaderboard published",
            body: "Final standings are available.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: "/mathlete/history",
            readAt: null,
            type: "leaderboard_published",
          },
        ]}
        unreadCount={1}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open notification" })).toHaveAttribute(
      "href",
      "/mathlete/history",
    );
    expect(screen.getByRole("button", { name: "Mark Leaderboard published as read" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all notifications as read" })).toBeInTheDocument();
  });

  test("renders inbox empty and unavailable states accessibly", () => {
    const { rerender } = render(
      <NotificationInboxShell
        notifications={[]}
        unreadCount={0}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    expect(screen.getByText("Inbox clear")).toBeInTheDocument();

    rerender(
      <NotificationInboxShell
        error="Notifications are temporarily unavailable."
        notifications={[]}
        unreadCount={0}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notifications are temporarily unavailable.",
    );
  });

  test("renders preference toggles with deterministic defaults", () => {
    render(
      <NotificationPreferencesShell
        action={async () => {}}
        preferences={{
          announcements: true,
          emailEnabled: false,
          inAppEnabled: true,
          leaderboardPublication: true,
          organizerDecisions: true,
          registrationReminders: true,
          scoreRecalculation: true,
          teamInvites: true,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Notification preferences" })).toBeInTheDocument();
    expect(screen.getByLabelText("In-app notifications")).toBeChecked();
    expect(screen.getByLabelText("Email notifications")).not.toBeChecked();
    expect(screen.getByLabelText("Team invites")).toBeChecked();
  });

  test("bell dropdown deep-links to notification routes and shows unread count", async () => {
    const user = userEvent.setup();

    render(<NotificationBellDropdown unreadCount={3} label="Organizer notifications" />);

    await user.click(screen.getByRole("button", { name: "Organizer notifications, 3 unread" }));

    expect(screen.getByRole("link", { name: "View inbox" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: "Notification settings" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
  });
});
