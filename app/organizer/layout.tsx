import { ProgressLink } from "@/components/ui/progress-link";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Decide which navigation items to show based on login status
  const navItems = user 
    ? [
        { href: "/organizer", label: "Dashboard" },
        { href: "/organizer/profile", label: "Profile" },
        { href: "/organizer/settings", label: "Settings" },
      ]
    : [
        { href: "/organizer/apply", label: "Apply" },
        { href: "/organizer/status", label: "Status" },
      ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="shell flex min-h-16 items-center justify-between gap-4 py-3">
          <ProgressLink href="/organizer" className="text-sm font-bold uppercase tracking-widest text-foreground">
            Organizer
          </ProgressLink>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {navItems.map((item) => (
              <ProgressLink key={item.href} href={item.href} className="rounded-md px-2 py-1 font-medium hover:bg-muted hover:text-foreground">
                {item.label}
              </ProgressLink>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
