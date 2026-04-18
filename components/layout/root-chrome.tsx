"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LandingHeaderNav } from "@/components/landing/landing-header-nav";
import { HeaderAuthNav } from "@/components/header-auth-nav";
import { MathwizBrand } from "@/components/landing/mathwiz-brand";
import { useAuth } from "@/components/providers/auth-provider";
import { ProgressLink } from "@/components/ui/progress-link";

const WORKSPACE_PREFIXES = ["/admin", "/mathlete", "/organizer", "/protected"];
const CHROMELESS_PREFIXES = ["/auth"];
const CHROMELESS_EXACT_PATHS = ["/profile/complete"];

function shouldHideGlobalChrome(pathname: string) {
  return (
    WORKSPACE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    CHROMELESS_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    CHROMELESS_EXACT_PATHS.includes(pathname)
  );
}

export function RootChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();
  const hideGlobalChrome = shouldHideGlobalChrome(pathname);
  const onLandingRoute = pathname === "/";
  const showLandingHeader = onLandingRoute && !user && !isLoading;
  const showFooter = !hideGlobalChrome && !onLandingRoute;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {onLandingRoute || hideGlobalChrome ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_55%)]" />
      )}

      {hideGlobalChrome ? null : (
        <header className="sticky top-0 z-50 px-4 pt-6">
          {showLandingHeader ? (
            <LandingHeaderNav />
          ) : (
            <div className="shell">
              <div className="flex min-h-16 items-center justify-between gap-3 rounded-full border border-slate-600/50 bg-[#0f172a]/95 px-3 py-2 text-slate-100 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.95)] backdrop-blur-xl sm:px-5">
                <ProgressLink
                  href="/"
                  className="rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
                >
                  <MathwizBrand className="text-white" labelClassName="text-lg" size={40} />
                </ProgressLink>

                <HeaderAuthNav />
              </div>
            </div>
          )}
        </header>
      )}

      <main className="relative flex-1">{children}</main>

      {showFooter ? (
        <footer className="border-t border-border/70 bg-background/70">
          <div className="shell flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>MathWiz Arena: secure math competition workflows for schools and organizers.</p>
            <p className="flex flex-wrap gap-4">
              <span>Built with Next.js, Tailwind CSS, Shadcn UI, and Supabase.</span>
              <span className="flex gap-3">
                <ProgressLink href="/privacy" className="hover:text-foreground">Privacy</ProgressLink>
                <ProgressLink href="/terms" className="hover:text-foreground">Terms</ProgressLink>
              </span>
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
