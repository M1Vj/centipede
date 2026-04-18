"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/mathlete" },
  { label: "Competitions", disabled: true },
  { label: "Teams", href: "/mathlete/teams" },
  { label: "History", disabled: true },
];

function isItemActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === "/mathlete") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MathleteWorkspaceNav() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    setIsMobileOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  const activeLabel = useMemo(
    () => navItems.find((item) => isItemActive(pathname, item.href))?.label ?? "Workspace",
    [pathname],
  );

  return (
    <header className="sticky top-0 z-40 px-4 pb-2 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1232px]">
        <div className="relative rounded-full border border-white/10 bg-[#10182b] px-5 py-3 text-white shadow-[0_24px_48px_-28px_rgba(16,24,43,0.9)]">
          <div className="flex items-center justify-between gap-4">
            <ProgressLink
              href="/mathlete"
              className="flex min-w-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700] focus-visible:ring-offset-2 focus-visible:ring-offset-[#10182b]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#273E9E_0%,#11192C_52%,#F49700_100%)] text-sm font-black uppercase tracking-[0.18em] text-white">
                M
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#f49700]">Mathlete</p>
                <p className="truncate text-xs text-white/55">{activeLabel}</p>
              </div>
            </ProgressLink>

            <nav className="hidden items-center gap-8 lg:flex" aria-label="Mathlete workspace navigation">
              {navItems.map((item) => {
                const active = isItemActive(pathname, item.href);

                if (!item.href) {
                  return (
                    <span
                      key={item.label}
                      className="text-lg font-semibold text-white/78"
                      aria-disabled="true"
                    >
                      {item.label}
                    </span>
                  );
                }

                return (
                  <ProgressLink
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "text-lg font-semibold transition-colors",
                      active ? "text-[#f49700]" : "text-white hover:text-[#f49700]",
                    )}
                  >
                    {item.label}
                  </ProgressLink>
                );
              })}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#f49700]/90 transition hover:bg-white/6 hover:text-[#f49700]"
                aria-label="Notifications"
                aria-disabled="true"
              >
                <Bell className="size-4" />
              </button>

              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto rounded-full px-1.5 py-1 text-white hover:bg-white/6 hover:text-white"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  aria-expanded={isProfileOpen}
                  aria-label="Open profile menu"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f49700] text-sm font-black text-[#10182b]">
                    M
                  </span>
                  <ChevronDown className="size-4 text-white/65" />
                </Button>

                {isProfileOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] w-48 rounded-3xl border border-white/10 bg-[#0d1425] p-2 shadow-[0_28px_60px_-32px_rgba(2,6,23,0.9)]">
                    <ProgressLink
                      href="/mathlete/settings"
                      className="block rounded-2xl px-4 py-3 text-sm font-medium text-white/88 transition hover:bg-white/6 hover:text-white"
                    >
                      Settings
                    </ProgressLink>
                    <div className="px-1 pb-1 pt-2">
                      <LogoutButton
                        label="Log out"
                        ariaLabel="Log out of mathlete workspace"
                        variant="ghost"
                        className="w-full justify-start rounded-2xl px-3 py-3 text-sm font-medium text-white/88 hover:bg-white/6 hover:text-white"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-white hover:bg-white/6 hover:text-white lg:hidden"
              onClick={() => setIsMobileOpen((current) => !current)}
              aria-expanded={isMobileOpen}
              aria-controls="mathlete-mobile-nav"
              aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
            >
              {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {isMobileOpen ? (
          <div
            id="mathlete-mobile-nav"
            className="mt-3 rounded-[2rem] border border-white/10 bg-[#10182b] p-3 text-white shadow-[0_24px_48px_-28px_rgba(16,24,43,0.9)] lg:hidden"
          >
            <nav className="space-y-1" aria-label="Mathlete mobile navigation">
              {navItems.map((item) => {
                const active = isItemActive(pathname, item.href);

                if (!item.href) {
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/62"
                      aria-disabled="true"
                    >
                      {item.label}
                    </div>
                  );
                }

                return (
                  <ProgressLink
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                      active ? "bg-white/10 text-[#f49700]" : "text-white/88 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    {item.label}
                  </ProgressLink>
                );
              })}
            </nav>

            <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
              <ProgressLink
                href="/mathlete/settings"
                className="rounded-2xl px-4 py-3 text-sm font-medium text-white/88 transition hover:bg-white/6 hover:text-white"
              >
                Settings
              </ProgressLink>
              <LogoutButton
                label="Log out"
                ariaLabel="Log out of mathlete workspace"
                variant="ghost"
                className="justify-start rounded-2xl px-4 py-3 text-sm font-medium text-white/88 hover:bg-white/6 hover:text-white"
              />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
