import type { ReactNode } from "react";
import { X } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

type MathleteModalPanelProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  closeHref?: string;
  closeLabel?: string;
  children: ReactNode;
  className?: string;
};

export function MathleteModalPanel({
  title,
  description,
  eyebrow,
  closeHref = "/mathlete/teams",
  closeLabel = "Close panel",
  children,
  className,
}: MathleteModalPanelProps) {
  return (
    <section className="shell flex min-h-[calc(100vh-9rem)] items-center justify-center pb-16 pt-6 md:pt-10">
      <div className={cn("relative w-full max-w-[760px]", className)}>
        <div className="absolute inset-0 rounded-[2.5rem] bg-[#f49700]/12 blur-3xl" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white shadow-[0_40px_80px_-40px_rgba(15,23,42,0.45)]">
          <div className="relative overflow-hidden bg-[#1a1e2e] px-6 py-7 text-white sm:px-8 md:px-10 md:py-8">
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(244,151,0,0.24),transparent_58%)]"
            />
            <div
              aria-hidden="true"
              className="absolute -left-8 top-4 h-28 w-28 rounded-full bg-white/6 blur-3xl"
            />

            <div className="relative flex items-start justify-between gap-4">
              <div className="space-y-3">
                {eyebrow ? (
                  <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#f49700]">
                    {eyebrow}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white">
                    {title}
                  </h1>
                  {description ? (
                    <p className="max-w-xl text-sm leading-7 text-white/68 md:text-base">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>

              <ProgressLink
                href={closeHref}
                aria-label={closeLabel}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white transition hover:bg-white/14"
              >
                <X className="size-5" />
              </ProgressLink>
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8 md:px-10 md:py-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
