import Image from "next/image";
import { ProgressLink } from "@/components/ui/progress-link";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isOrganizer = false;
  let unreadCount = 0;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>();
    isOrganizer = profile?.role === "organizer";

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }
  
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
            isOrganizer={isOrganizer}
            isAuthenticated={Boolean(user)}
            unreadCount={unreadCount}
          />
        </nav>
      </header>
      {children}
    </div>
  );
}
