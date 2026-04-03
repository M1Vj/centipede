import { ProgressLink } from "@/components/ui/progress-link";

const navItems = [
  { href: "/organizer/apply", label: "Apply" },
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer", label: "Dashboard" },
  { href: "/organizer/profile", label: "Profile" },
  { href: "/organizer/settings", label: "Settings" },
];

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
