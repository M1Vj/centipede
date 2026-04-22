"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, Menu, Settings, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

const organizerItems: NavItem[] = [
  { href: "/organizer", label: "Dashboard" },
  { href: "/organizer/competition", label: "Competitions" },
  { href: "/organizer/problem-bank", label: "Problem Banks" },
  { href: "/organizer/scoring", label: "Scoring" },
];

const guestItems: NavItem[] = [
  { href: "/organizer/apply", label: "Apply" },
  { href: "/organizer/status", label: "Status" },
];

export function OrganizerNav({
  isOrganizer,
  isAuthenticated,
}: {
  isOrganizer: boolean;
  isAuthenticated: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navItems = isAuthenticated && isOrganizer ? organizerItems : guestItems;

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="hidden items-center gap-2 absolute left-1/2 -translate-x-1/2 md:flex"
        aria-label="Organizer navigation"
      >
        {navItems.map((item) => {
          const active =
            item.href === "/organizer" ? pathname === "/organizer" : pathname.startsWith(item.href);

          return (
            <ProgressLink
              key={item.href}
              href={item.href}
              className={cn(
                "organizer-nav-chip",
                active ? "organizer-nav-chip-active" : "organizer-nav-chip-inactive",
              )}
            >
              {item.label}
            </ProgressLink>
          );
        })}
      </nav>

      {isAuthenticated ? (
        <div className="relative ml-auto hidden md:block">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#f9c96a] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#111827]" />
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
              aria-label="Open organizer profile menu"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              O
              <ChevronDown className="size-3.5 text-white/70" />
            </button>
          </div>

          {profileOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+12px)] w-64 rounded-[1.5rem] border border-border/70 bg-card p-2.5 text-foreground shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]"
              role="menu"
            >
              <ProgressLink
                href="/organizer/profile"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground/80 transition hover:bg-secondary"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <UserCircle2 className="size-4" />
                Profile
              </ProgressLink>
              <ProgressLink
                href="/organizer/settings"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground/80 transition hover:bg-secondary"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <Settings className="size-4" />
                Settings
              </ProgressLink>
              <div className="px-2 pt-1">
                <LogoutButton
                  label="Sign out"
                  aria-label="Sign out of organizer workspace"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start rounded-2xl px-2 py-3 text-sm font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 md:hidden"
        aria-label="Open organizer navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="size-5" />
      </button>

      {mobileOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%+12px)] rounded-[1.75rem] border border-border/70 bg-card p-3 text-foreground shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] md:hidden">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === "/organizer" ? pathname === "/organizer" : pathname.startsWith(item.href);

              return (
                <ProgressLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </ProgressLink>
              );
            })}
            {isAuthenticated ? (
              <>
                <ProgressLink
                  href="/organizer/profile"
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-foreground/80 transition hover:bg-secondary hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Profile
                </ProgressLink>
                <ProgressLink
                  href="/organizer/settings"
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-foreground/80 transition hover:bg-secondary hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Settings
                </ProgressLink>
                <div className="pt-1">
                  <LogoutButton
                    label="Sign out"
                    aria-label="Sign out of organizer workspace"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start rounded-2xl px-4 py-3 text-sm font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground"
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
