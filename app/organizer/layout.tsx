import Image from "next/image";
import { ProgressLink } from "@/components/ui/progress-link";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { markAllNotificationsRead } from "@/lib/notifications/actions";
import { fetchNotificationPreviewSnapshot } from "@/lib/notifications/preview";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const notificationSnapshot = await fetchNotificationPreviewSnapshot();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4">
        <nav className="relative flex w-full max-w-[1024px] items-center justify-between rounded-full border border-white/5 bg-secondary px-5 py-3 shadow-2xl backdrop-blur-md">
          
          {/* Logo Area */}
          <ProgressLink
            href="/organizer"
            className="flex items-center gap-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
          >
            <Image
              src="/mathwiz-logo.svg"
              alt="MathWiz"
              width={96}
              height={28}
              className="object-contain"
              style={{ width: "auto", height: "28px" }}
            />
            <span className="text-[14px] font-bold tracking-wide text-primary">
              Organizer
            </span>
          </ProgressLink>

          {/* Nav + Actions */}
          <OrganizerNav
            isAuthenticated={Boolean(notificationSnapshot.userId)}
            markAllNotificationsRead={markAllNotificationsRead}
            notifications={notificationSnapshot.notifications}
            unreadCount={notificationSnapshot.unreadCount}
          />
        </nav>
      </header>
      {children}
    </div>
  );
}
