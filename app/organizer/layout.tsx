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
    <div className="min-h-screen bg-[#f8f6f6]">
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4">
        <nav className="backdrop-blur-md bg-[#1a1e2e] w-full max-w-[1024px] rounded-full px-5 py-3 flex items-center justify-between shadow-2xl border border-white/5 relative">
          
          {/* Logo Area */}
          <ProgressLink
            href="/organizer"
            className="flex items-center gap-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1e2e]"
          >
            <img
              src="/mathwiz-logo.svg"
              alt="MathWiz"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[#f49700] font-bold text-[14px] tracking-wide">
              Organizer
            </span>
          </ProgressLink>

          {/* Nav + Actions */}
          <OrganizerNav isOrganizer={isOrganizer} isAuthenticated={Boolean(user)} />
        </nav>
      </header>
      {children}
    </div>
  );
}
