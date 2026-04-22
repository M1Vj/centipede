"use client";

import { useState } from "react";
import { Bell, Menu, Settings, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface OrganizerNavProps {
  isOrganizer: boolean;
  isAuthenticated: boolean;
}

const organizerItems = [
  { href: "/organizer", label: "Dashboard" },
  { href: "/organizer/competition", label: "Competitions" },
  { href: "/organizer/problem-bank", label: "Problembanks" },
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
      {/* Desktop Nav Links — centered absolutely */}
      <nav className="hidden items-center gap-10 absolute left-1/2 -translate-x-1/2 md:flex" aria-label="Organizer navigation">
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
                "font-semibold text-[15px] transition-colors",
                active
                  ? "text-[#f49700]"
                  : "text-white hover:text-[#f49700]",
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

      {/* Desktop Right Actions */}
      {isAuthenticated ? (
        <div className="relative hidden md:block">
          <div className="flex items-center gap-4 pr-2 bg-[#0f121a] rounded-full pl-6 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative mr-2 text-[#f49700] transition-colors hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 rounded-3xl border-slate-200 p-2.5">
                <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-slate-900">
                  Notifications
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-4 text-sm text-slate-500">
                  No notifications yet. Competition and team updates will appear here.
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="w-8 h-8 rounded-full bg-[#f49700] shadow-md cursor-pointer hover:bg-[#e08900] transition-colors flex items-center justify-center text-white font-bold text-[13px]"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              O
            </button>
          </div>

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

      {/* Mobile Menu Toggle */}
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0f121a] text-white md:hidden"
        aria-label="Open organizer navigation"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile Menu Dropdown */}
      {menuOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%+12px)] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] md:hidden">
          <div className="space-y-1">
            {navItems.map((item) =>
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
            )}
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
