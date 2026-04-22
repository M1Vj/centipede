import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  LayoutDashboard,
  Users,
  FileText,
  Library,
  Trophy,
  History,
  Settings
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";
import { AdminMobileNav } from "@/app/admin/mobile-nav";

async function getAdminProfile() {
  await getWorkspaceContext({ requireRole: "admin" });
}

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Problem Banks", href: "/admin/problem-banks", icon: Library },
  { label: "Competitions", href: "/admin/competitions", icon: Trophy },
  { label: "Audit Logs", href: "/admin/logs", icon: History },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getAdminProfile();

  return (
    <div className="flex min-h-screen flex-col bg-muted/20 md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <ProgressLink href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs">
              AD
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">Admin Portal</span>
          </ProgressLink>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <ProgressLink
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </ProgressLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <div className="rounded-xl bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">System Mode</p>
            <p className="mt-1 text-xs font-semibold text-primary">Live Monitoring</p>
          </div>
          <LogoutButton
            label="Sign out"
            ariaLabel="Sign out of admin workspace"
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-center"
          />
        </div>
      </aside>

      <AdminMobileNav />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <main className="min-h-full">{children}</main>
      </div>
    </div>
  );
}
