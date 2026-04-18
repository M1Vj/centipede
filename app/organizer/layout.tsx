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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f6f6_0%,#f8f6f6_100%)]">
      <header className="sticky top-0 z-40 px-2 py-4 sm:px-4">
        <div className="shell">
          <div className="relative flex min-h-16 items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-[#10182b] px-4 py-2 text-slate-100 shadow-[0_26px_58px_-34px_rgba(2,6,23,0.9)] sm:px-5">
            <ProgressLink
              href="/organizer"
              className="flex items-center gap-3 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10182b]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#11192c] text-xs font-black uppercase tracking-[0.16em] text-[#f59f0a]">
                MW
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-bold text-[#f59f0a]">Organizer</p>
                <p className="text-[11px] text-white/70">MathWiz</p>
              </div>
            </ProgressLink>
            <OrganizerNav isOrganizer={isOrganizer} isAuthenticated={Boolean(user)} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
