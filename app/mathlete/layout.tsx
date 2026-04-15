import { ProgressLink } from "@/components/ui/progress-link";

const navItems = [
  { href: "/mathlete", label: "Dashboard" },
  { href: "/mathlete/teams", label: "Teams" },
  { href: "/mathlete/settings", label: "Settings" },
];

export default function MathleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="shell flex min-h-16 items-center justify-between gap-4 py-3">
          <ProgressLink
            href="/mathlete"
            className="text-sm font-bold uppercase tracking-widest text-foreground"
          >
            Mathlete
          </ProgressLink>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground md:gap-x-3 md:gap-y-1">
            {navItems.map((item) => (
              <ProgressLink
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 font-medium hover:bg-muted hover:text-foreground md:px-2 md:py-1"
              >
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
