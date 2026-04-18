"use client";

import { ProgressLink } from "@/components/ui/progress-link";
import { MathwizBrand } from "@/components/landing/mathwiz-brand";

const landingAnchors = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "methodology", label: "Methodology" },
  { id: "pricing", label: "Pricing" },
];

export function LandingHeaderNav() {
  return (
    <div className="shell">
      <div className="flex min-h-[4.875rem] items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-[#0f172a] px-4 py-3 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.85)] backdrop-blur">
        <ProgressLink
          href="/"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59b00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          aria-label="MathWiz home"
        >
          <MathwizBrand showText={false} size={40} />
        </ProgressLink>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Landing sections">
          {landingAnchors.map((item) => (
            <ProgressLink
              key={item.id}
              href={`#${item.id}`}
              className="text-sm font-semibold text-white transition hover:text-[#f8d191] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59b00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            >
              {item.label}
            </ProgressLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ProgressLink
            href="/auth/sign-up"
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#f59b00] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-18px_rgba(245,155,0,0.95)] transition hover:bg-[#e18f00] sm:px-5 sm:text-sm"
          >
            Start Free Trial
          </ProgressLink>
          <ProgressLink
            href="/auth/login"
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-slate-100 px-4 text-xs font-bold text-[#0f172a] transition hover:bg-white sm:px-5 sm:text-sm"
          >
            Login
          </ProgressLink>
        </div>
      </div>
    </div>
  );
}
