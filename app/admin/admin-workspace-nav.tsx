"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  FileText,
  History,
  LayoutDashboard,
  Library,
  Menu,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Problem Banks", href: "/admin/problem-banks", icon: Library },
  { label: "Competitions", href: "/admin/competitions", icon: Trophy },
  { label: "Audit Logs", href: "/admin/logs", icon: History },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminWorkspaceNav() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 lg:flex"
        aria-label="Admin navigation"
      >
        {navItems.map((item) => {
          const active = isItemActive(pathname, item.href);

          return (
            <ProgressLink
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </ProgressLink>
          );
        })}
      </nav>

      <div className="hidden items-center gap-3 lg:flex">
        <div className="rounded-full bg-[#0f121a] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          Live Monitoring
        </div>
        <LogoutButton
          label="Sign out"
          ariaLabel="Sign out of admin workspace"
          variant="outline"
          size="sm"
          className="border-white/25 bg-white/5 text-slate-100 hover:bg-white/15 hover:text-white focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
        />
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0f121a] text-white lg:hidden"
        aria-expanded={menuOpen}
        aria-label="Open admin navigation"
      >
        <Menu className="size-5" />
      </button>

      {menuOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%+12px)] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] lg:hidden">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isItemActive(pathname, item.href);

              return (
                <ProgressLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </ProgressLink>
              );
            })}
            <div className="pt-1">
              <LogoutButton
                label="Sign out"
                ariaLabel="Sign out of admin workspace"
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
