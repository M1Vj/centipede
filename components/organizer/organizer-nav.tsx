"use client";

import { useState } from "react";
import { Menu, Settings, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

interface OrganizerNavProps {
  isOrganizer: boolean;
  isAuthenticated: boolean;
}

const organizerItems = [
  { href: "/organizer", label: "Dashboard" },
  { href: "/organizer/competition", label: "Competitions" },
  { href: "/organizer/problem-bank", label: "Problem Banks" },
  { href: "/organizer/history", label: "History" },
];

const guestItems = [
  { href: "/organizer/apply", label: "Apply" },
  { href: "/organizer/status", label: "Status" },
];

export function OrganizerNav({ isOrganizer, isAuthenticated }: OrganizerNavProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = isAuthenticated && isOrganizer ? organizerItems : guestItems;

  return (
    <>
      <nav className="hidden items-center gap-x-3 gap-y-1 md:flex" aria-label="Organizer navigation">
        {navItems.map((item) => {
          const active =
            item.href === "/organizer"
              ? pathname === "/organizer"
              : pathname.startsWith(item.href);

          return (
            <ProgressLink
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-2 py-1 text-base font-semibold transition md:px-4 md:py-2",
                active
                  ? "text-[#f59f0a]"
                  : "text-white/92 hover:text-[#f8c164]",
              )}
            >
              {item.label}
            </ProgressLink>
          );
        })}
        {isAuthenticated && isOrganizer ? (
          <>
            <ProgressLink href="/organizer/profile" className="sr-only px-2 py-1">
              Profile
            </ProgressLink>
            <ProgressLink href="/organizer/settings" className="sr-only px-2 py-1">
              Settings
            </ProgressLink>
          </>
        ) : null}
      </nav>

      {isAuthenticated ? (
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0d1424] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#141d32]"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="rounded-full bg-[#f59f0a] px-5 py-2 text-white shadow-[0_10px_25px_-16px_rgba(245,159,10,0.9)]">
              Organizer
            </span>
          </button>

          {menuOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+12px)] w-60 rounded-3xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]"
              role="menu"
            >
              <ProgressLink
                href="/organizer/profile"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <UserCircle2 className="size-4" />
                Profile
              </ProgressLink>
              <ProgressLink
                href="/organizer/settings"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <Settings className="size-4" />
                Settings
              </ProgressLink>
              <div className="px-2 pt-1">
                <LogoutButton
                  label="Sign out"
                  ariaLabel="Sign out of organizer workspace"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start rounded-2xl px-2 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0d1424] text-white md:hidden"
        aria-label="Open organizer navigation"
      >
        <Menu className="size-5" />
      </button>

      {menuOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%+12px)] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] md:hidden">
          <div className="space-y-1">
            {navItems.map((item) => (
              "disabled" in item && item.disabled ? (
                <div
                  key={item.label}
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-400"
                  aria-disabled="true"
                >
                  {item.label}
                </div>
              ) : (
                <ProgressLink
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </ProgressLink>
              )
            ))}
            {isAuthenticated ? (
              <>
                <ProgressLink
                  href="/organizer/profile"
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </ProgressLink>
                <ProgressLink
                  href="/organizer/settings"
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </ProgressLink>
                <div className="pt-1">
                  <LogoutButton
                    label="Sign out"
                    ariaLabel="Sign out of organizer workspace"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
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
