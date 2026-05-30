// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
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
    expect(
      screen.getByRole("link", { name: /Open Leaderboard published from/ }),
    ).toHaveAttribute("href", "/mathlete/history");
    expect(screen.getByRole("button", { name: "Mark Leaderboard published as read" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all notifications as read" })).toBeInTheDocument();
  });

  test("passes mark-all action to the inbox header notification bell", async () => {
    const user = userEvent.setup();

    render(
      <NotificationInboxShell
        notifications={[
          {
            id: "notification-1",
            title: "Team invite",
            body: "Join Team One.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: "/mathlete/teams/invites",
            readAt: null,
            type: "team_invite_created",
          },
        ]}
        role="mathlete"
        unreadCount={1}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mathlete notifications, 1 unread" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("link", { name: "View inbox" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Mark all notifications as read" })).toBeEnabled();
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

  test("emphasizes the inbox all-read state after notifications are cleared", () => {
    render(
      <NotificationInboxShell
        notifications={[
          {
            id: "notification-1",
            title: "Leaderboard published",
            body: "Final standings are available.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: "/mathlete/history",
            readAt: "2026-05-05T03:00:00.000Z",
            type: "leaderboard_published",
          },
        ]}
        unreadCount={0}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "All notifications are marked as read.",
    );
    expect(screen.getAllByText("All read")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "All notifications are read" })).toBeDisabled();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });

  test("keeps notifications visible when only unread count is unavailable", () => {
    render(
      <NotificationInboxShell
        warning="Unread count is temporarily unavailable."
        notifications={[
          {
            id: "notification-1",
            title: "Score recalculated",
            body: "Your score changed.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: null,
            readAt: null,
            type: "score_recalculated",
          },
        ]}
        unreadCount={1}
        markAllAction={async () => {}}
        markReadAction={async () => {}}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Unread count is temporarily unavailable.",
    );
    expect(screen.getByText("Score recalculated")).toBeInTheDocument();
    expect(screen.queryByText("Notifications are temporarily unavailable.")).not.toBeInTheDocument();
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

  test("bell dropdown shows recent notification previews and deep-links to notification routes", async () => {
    const user = userEvent.setup();
    const markAllAction = vi.fn();

    render(
      <NotificationBellDropdown
        unreadCount={3}
        label="Organizer notifications"
        markAllAction={markAllAction}
        notifications={[
          {
            id: "notification-1",
            title: "Competition announcement",
            body: "Room assignments are now available in the competition overview.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: "/mathlete/competition/00000000-0000-0000-0000-000000000000",
            readAt: null,
            type: "competition_announcement_posted",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Organizer notifications, 3 unread" }));

    expect(screen.getByText("Competition announcement")).toBeInTheDocument();
    expect(
      screen.getByText("Room assignments are now available in the competition overview."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View inbox" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Mark all notifications as read" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Notification settings" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
  });

  test("bell dropdown disables mark-all when there are no unread notifications", async () => {
    const user = userEvent.setup();

    render(
      <NotificationBellDropdown
        unreadCount={0}
        label="Mathlete notifications"
        markAllAction={async () => {}}
        notifications={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mathlete notifications" }));

    expect(screen.getByRole("button", { name: "Mark all notifications as read" })).toBeDisabled();
  });

  test("bell dropdown emphasizes all-read previews when unread count reaches zero", async () => {
    const user = userEvent.setup();

    render(
      <NotificationBellDropdown
        unreadCount={0}
        label="Mathlete notifications"
        markAllAction={async () => {}}
        notifications={[
          {
            id: "notification-1",
            title: "Team invite handled",
            body: "The invite has been handled.",
            createdAt: "2026-05-05T02:00:00.000Z",
            linkPath: "/mathlete/teams/invites",
            readAt: "2026-05-05T03:00:00.000Z",
            type: "team_invite_created",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mathlete notifications" }));

    expect(screen.getByText("All notifications read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All notifications are read" })).toBeDisabled();
    expect(screen.getByText("Team invite handled")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });
});
