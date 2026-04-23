"use client";

import { useEffect, useState } from "react";
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

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/mathlete" },
  { label: "Competitions", href: "/mathlete/competition" },
  { label: "Teams", href: "/mathlete/teams" },
  { label: "History", href: "/mathlete#history" },
];

function isItemActive(pathname: string, currentHash: string, href: string) {
  const [targetPath, targetHash] = href.split("#");

  if (targetHash) {
    return pathname === targetPath && currentHash === `#${targetHash}`;
  }

  if (href === "/mathlete") {
    return pathname === href && !currentHash;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MathleteWorkspaceNav() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const syncHash = () => {
      if (typeof window !== "undefined") {
        setCurrentHash(window.location.hash);
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, currentHash]);

  return (
    <>
      <nav
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex"
        aria-label="Mathlete navigation"
      >
        {navItems.map((item) => {
          const active = isItemActive(pathname, currentHash, item.href);

          return (
            <ProgressLink
              key={item.href}
              href={item.href}
              className={cn(
                "font-semibold text-[15px] transition-colors",
                active ? "text-[#f49700]" : "text-white hover:text-[#f49700]",
              )}
            >
              {item.label}
            </ProgressLink>
          );
        })}
        <ProgressLink href="/mathlete/settings" className="sr-only px-2 py-1">
          Settings
        </ProgressLink>
      </nav>

      <div className="relative hidden md:block">
        <div className="flex items-center gap-4 rounded-full bg-[#0f121a] py-1 pl-6 pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative mr-2 text-[#f49700] transition-colors hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-3xl border-slate-200 p-2.5">
              <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-slate-900">
                Notifications
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-3 py-4 text-sm text-slate-500">
                No notifications yet. Competition updates will appear here.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f49700] text-[13px] font-bold text-white shadow-md transition-colors hover:bg-[#e08900]"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            M
          </button>
        </div>

        {menuOpen ? (
          <div
            className="absolute right-0 top-[calc(100%+12px)] w-60 rounded-3xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]"
            role="menu"
          >
            <ProgressLink
              href="/mathlete"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <UserCircle2 className="size-4" />
              Dashboard
            </ProgressLink>
            <ProgressLink
              href="/mathlete/settings"
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
                ariaLabel="Sign out of mathlete workspace"
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-2xl px-2 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              />
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0f121a] text-white md:hidden"
        aria-label="Open mathlete navigation"
      >
        <Menu className="size-5" />
      </button>

      {menuOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%+12px)] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] md:hidden">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isItemActive(pathname, currentHash, item.href);

              return (
                <ProgressLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-slate-50 text-[#f49700]"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </ProgressLink>
              );
            })}
            <ProgressLink
              href="/mathlete/settings"
              className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Settings
            </ProgressLink>
            <div className="pt-1">
              <LogoutButton
                label="Sign out"
                ariaLabel="Sign out of mathlete workspace"
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
