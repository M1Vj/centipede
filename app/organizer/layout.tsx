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
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>();
    isOrganizer = profile?.role === "organizer";
  }
  
  return (
    <div className="organizer-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 px-4 py-4 backdrop-blur-xl">
        <div className="shell relative flex items-center justify-between gap-4 rounded-[1.75rem] border border-border/70 bg-[#111827]/95 px-4 py-3 text-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.8)]">
          <ProgressLink
            href="/organizer"
            className="flex items-center gap-3 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
          >
            <span className="text-lg font-black tracking-tight text-white">MathWiz</span>
            <span className="organizer-kicker border-white/10 bg-white/5 text-[#f9c96a]">
              Organizer
            </span>
          </ProgressLink>
          <OrganizerNav isOrganizer={isOrganizer} isAuthenticated={Boolean(user)} />
        </div>
      </header>
      {children}
    </div>
  );
}
